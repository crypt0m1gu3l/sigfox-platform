import {Model} from '@mean-expert/model';
import * as _ from 'lodash';
import {decrypt} from '../utils';

const loopback = require('loopback');

/**
 * @module Alert
 * @description
 * Write a useful Alert Model description.
 * Register hooks and remote methods within the
 * Model Decorator
 **/
@Model({
  hooks: {
    beforeSave: { name: 'before save', type: 'operation' }
  },
  remotes: {
    triggerByDevice: {
      returns : { arg: 'result', type: 'array' },
      http    : { path: '/trigger-by-device', verb: 'post' },
      accepts: [
        {arg: 'data_parsed', type: 'array', required: true, description: 'The parsed data'},
        {arg: 'device', type: 'Device', required: true, description: 'The device object'},
        {arg: 'req', type: 'object', http: {source: 'req'}}
      ],
    },
    triggerBySigfoxGeoloc: {
      returns : { arg: 'result', type: 'array' },
      http    : { path: '/trigger-by-sigfox-geoloc', verb: 'post' },
      accepts: [
        {arg: 'lat', type: 'number', required: true, description: 'The lat of the device'},
        {arg: 'lng', type: 'number', required: true, description: 'The lng of the device'},
        {arg: 'deviceId', type: 'string', required: true, description: 'The device ID'},
        {arg: 'req', type: 'object', http: {source: 'req'}}
      ],
    }
  }
})

class Alert {
  // LoopBack model instance is injected in constructor
  constructor(public model: any) {}

  beforeSave(ctx: any, next: Function): void {
    console.log('Alert: Before Save');
    next();
  }

  private triggerBySigfoxGeoloc(lat: number, lng: number, deviceId: string, req: any, next: Function): void {
    // Models
    const Device = this.model.app.models.Device;

    // Get userId
    const userId = req.accessToken.userId;
    if (!userId) {
      next(null, 'Please login or use a valid access token.');
    }
    Device.findOne(
      {
        where: {
          and: [
            {id: deviceId},
            {userId: userId}
          ]
        },
        include: ['Alerts']
      }, (err: any, deviceInstance: any) => {
        if (err || !deviceInstance) {
          console.error('Device not found.');
          next(err, 'Device not found.');
        } else {
          deviceInstance = deviceInstance.toJSON();
          if (!deviceInstance.Alerts) {
            next(null, 'No alerts set for this device.');
          }

          const alerts = deviceInstance.Alerts;

          if (lat && lng) {
            // Loop in all the alerts
            alerts.forEach((alert: any, index: any) => {
              // Only check active alerts
              if (alert.active && alert.geofence && alert.key === 'geoloc_sigfox') {
                /**
                 *  Triggering alerts from "lat" and "lng" from Sigfox geoloc
                 *  If the key being read is set for an alert and if it is activated
                 */
                const location_device = new loopback.GeoPoint({lat: Number(lat), lng: Number(lng)});
                alert.geofence.forEach((alertGeofence: any) => {
                  // If geofence is a circle
                  if (alertGeofence.radius) {
                    // Check trigger conditions
                    if (alertGeofence.in && this.isDeviceInsideCircle(location_device, alertGeofence)) {
                      // Trigger alert
                      let alertMessage = alert.message;
                      if (!alert.message)
                        alertMessage = 'Device is in the circle!';
                      this.triggerAlert(alert, deviceInstance, alertMessage);
                      // Alert has been triggered, removing it from array
                      alerts.splice(index, 1);
                    }
                  }
                  // If geofence is a polygon
                  else {
                    // Check trigger conditions
                    if (alertGeofence.in && this.isDeviceInsidePolygon(location_device, alertGeofence.location)) {
                      // Trigger alert
                      let alertMessage = alert.message;
                      if (!alert.message)
                        alertMessage = 'Device is in the polygon!';
                      this.triggerAlert(alert, deviceInstance, alertMessage);
                      // Alert has been triggered, removing it from array
                      alerts.splice(index, 1);
                    }
                  }
                });
              }
            });
          }
          next(null, 'Processed Sigfox geoloc alerts.');
        }
      });
  }

  private triggerByDevice(data_parsed: Array<any>, device: any, req: any, next: Function): void {
    // Get userId
    const userId = req.accessToken.userId;
    if (!userId) {
      next(null, 'Please login or use a valid access token.');
    } else if (!device.Alerts) {
      next(null, 'No alerts set for this device.');
    }

    const alerts = device.Alerts;

    // Loop in all the alerts
    alerts.forEach((alert: any, index: any) => {
      // Only check active alerts
      if (alert.active) {
        if (alert.geofence && alert.key !== 'geoloc_sigfox') {
          /**
           *  Triggering alerts from "lat" and "lng" in "data_parsed"
           *  If the key being read is set for an alert and if it is activated
           */
          alert.geofence.forEach((alertGeofence: any) => {
            const lat_device = +_.filter(data_parsed, {key: 'lat'})[0].value;
            const lng_device = +_.filter(data_parsed, {key: 'lng'})[0].value;
            if (lat_device && lng_device) {
              const location_device = new loopback.GeoPoint({lat: Number(lat_device), lng: Number(lng_device)});
              // If geofence is a circle
              if (alertGeofence.radius) {
                // Check trigger conditions
                if (alertGeofence.in && this.isDeviceInsideCircle(location_device, alertGeofence)) {
                  // Trigger alert
                  let alertMessage = alert.message;
                  if (!alert.message)
                    alertMessage = 'Device is in the circle!';
                  this.triggerAlert(alert, device, alertMessage);
                  // Alert has been triggered, removing it from array
                  alerts.splice(index, 1);
                }
              }
              // If geofence is a polygon
              else {
                // Check trigger conditions
                if (alertGeofence.in && this.isDeviceInsidePolygon(location_device, alertGeofence.location)) {
                  // Trigger alert
                  let alertMessage = alert.message;
                  if (!alert.message)
                    alertMessage = 'Device is in the polygon!';
                  this.triggerAlert(alert, device, alertMessage);
                  // Alert has been triggered, removing it from array
                  alerts.splice(index, 1);
                }
              }
            }
          });
        } else if (alert.value) {
          /**
           *  Triggering alerts from keys in "data_parsed"
           *  If the key being read is set for an alert and if it is activated
           */
            // Build the custom message
          let alertMessage = '';
          let strToMatch = '';
          const regex = /\[(.*?)\]/;
          if (alert.message) {
            try {
              strToMatch = JSON.stringify(alert.message);
            } catch (e) {
              strToMatch = alert.message;
            }
          }
          data_parsed.forEach((p: any) => {
            if (alert.message) {
              try {
                const matched = regex.exec(strToMatch)[1];
                if (matched && matched === p.key) {
                  strToMatch = strToMatch.replace('[' + matched + ']', p.value.toString());
                  alertMessage = JSON.parse(strToMatch);
                }
              } catch (e) {
                //console.log('No need to search for a custom message formatting.');
              }
              if (alertMessage === '') {
                alertMessage = alert.message;
              }
            }
          });

          // Process conditions
          data_parsed.forEach((p: any) => {
            if (alert.key === p.key) {
              // Verify conditions for the alert to be triggered
              if (
                (alert.value.exact && p.value === alert.value.exact)
                || (alert.value.min && alert.value.max && p.value >= alert.value.min && p.value <= alert.value.max)
                || (alert.value.less && p.value < alert.value.less)
                || (alert.value.more && p.value > alert.value.more)
              ) {
                if (!alert.message) {
                  alertMessage = p.key.charAt(0).toUpperCase() + p.key.slice(1) + ': ' + p.value + ' ' + p.unit;
                }
                // Trigger alert
                this.triggerAlert(alert, device, alertMessage);
                // Alert has been triggered, removing it from array
                alerts.splice(index, 1);
              }
            }
          });
        }
      }
    });
    next(null, 'Processed alerts.');
  }

  private triggerAlert(alert: any, device: any, alertMessage: string) {
    // Models
    const Connector = this.model.app.models.Connector;
    const Email = this.model.app.models.Email;
    const Alert = this.model.app.models.Alert;
    const AlertHistory = this.model.app.models.AlertHistory;

    Connector.findById(alert.connectorId,
      (err: any, connector: any) => {
        if (err) {
          console.error(err);
        } else if (connector) {
          if (connector.type === 'office-365') {
            console.log('Office 365 Email alert!');
            // Set the connector user and pass
            this.model.app.models.Email.dataSource.connector.transports[0].transporter.options.auth = {
              user: connector.login,
              pass: decrypt(connector.password)
            };
            const title = device.name ? device.name : device.id;
            Email.send({
              to: connector.recipient,
              from: connector.login,
              subject: '[Sigfox Platform] - Alert for ' + title,
              text: alertMessage,
              html: 'Hey! <p>An alert has been triggered for the device: <b>' + title + '</b></p><p>' + alertMessage + '</p>'
            }, function (err: any, mail: any) {
              if (err) console.error(err);
              else console.log('Email sent!');
            });
          }

          else if (connector.type === 'webhook') {
            console.log('Webhook alert!');
            try {
              alertMessage = JSON.parse(alertMessage);
            } catch (e) {
              alertMessage = 'Invalid JSON in webhook alert message!';
            }
            this.model.app.dataSources.webhook.send(connector.url, connector.method, decrypt(connector.password), alertMessage).then((result: any) => {
              console.log('Webhook request sent!');
            }).catch((err: any) => {
              if (err) console.error(err);
            });
          }

          else if (connector.type === 'free-mobile') {
            console.log('Free Mobile SMS alert!');
            this.model.app.dataSources.freeMobile.sendSMS(connector.login, decrypt(connector.password), alertMessage).then((result: any) => {
            }).catch((err: any) => {
              if (err) console.error('Free Mobile error');
              else console.log('Free Mobile sent!');
            });
          }

          else if (connector.type === 'twilio') {
            console.log('Twilio SMS alert!');
            // TODO: implement twilio connector
          }

          else if (connector.type === 'mqtt') {
            console.log('MQTT alert!');
            const Client = require('strong-pubsub');
            const Adapter = require('strong-pubsub-mqtt');
            const client = new Client({host: connector.host, port: connector.port}, Adapter);
            try {
              client.publish(connector.topic, alertMessage);
            } catch (e) {
              console.log(e);
            }
          }

          // Check if alert is one shot only, if yes: deactivate it
          if (alert.one_shot) alert.active = false;
          // Update the alert last trigger time
          alert.triggeredAt = new Date();
          Alert.upsert(
            alert,
            (err: any, alertInstance: any) => {
              if (err) {
                console.error(err);
              } else {
                console.log('Updated alert as: ', alertInstance);
                // Save triggered alerts in AlertHistory
                alertInstance.message = alertMessage;
                AlertHistory.create(alertInstance, (err: any, alert: any) => {
                  console.log('Created alert history');
                });
              }
            });
        }
      });
  }

  isDeviceInsideCircle(marker: any, alertGeofence: any): boolean {
    let inside = false;
    const location_geofence = new loopback.GeoPoint(alertGeofence.location[0]);
    const distanceToGeofence = marker.distanceTo(location_geofence, {type: 'meters'});
    if (distanceToGeofence <= alertGeofence.radius) inside = !inside;
    return inside;
  }

  isDeviceInsidePolygon(marker: any, polygon: any): boolean {
    const x = marker.lat, y = marker.lng;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lat, yi = polygon[i].lng;
      const xj = polygon[j].lat, yj = polygon[j].lng;
      const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

}

module.exports = Alert;
