import {Model} from '@mean-expert/model';

const loopback = require('loopback');

/**
 * @module Geoloc
 * @description
 * Write a useful Geoloc Model description.
 * Register hooks and remote methods within the
 * Model Decorator
 **/
@Model({
  hooks: { },
  remotes: {
    createFromParsedPayload: {
      returns : { arg: 'result', type: 'array' },
      http    : { path: '/from-payload', verb: 'post' },
      accepts: [
        {arg: 'message', type: 'Message', required: true, description: 'The message object'}
      ],
    },
    postSigfox: {
      accepts: [
        {arg: 'req', type: 'object', http: {source: 'req'}},
        {arg: 'data', type: 'object', required: true, http: { source: 'body' }}
      ],
      http: {
        path: '/sigfox',
        verb: 'post'
      },
      returns: {type: 'Geoloc', root: true}
    }
  }
})

class Geoloc {
  // LoopBack model instance is injected in constructor
  constructor(public model: any) {
  }

  private createFromParsedPayload(message: any, req: any): void {
    // Models
    const Geoloc = this.model;
    const Beacon = this.model.app.models.Beacon;

    if (typeof message === 'undefined') {
      return console.error('Missing "message"', message);
    } else if (typeof message.data_parsed === 'undefined') {
      return console.log('----------> Missing "data_parsed", not trying to decode Geoloc.');
    }

    let hasGpsLocation = false;
    let hasBeaconLocation = false;
    let hasWifiLocation = false;

    // Build the GPS Geoloc object
    const geoloc_gps = new Geoloc;
    geoloc_gps.location = new loopback.GeoPoint({lat: 0, lng: 0});
    geoloc_gps.createdAt = message.createdAt;
    geoloc_gps.userId = message.userId;
    geoloc_gps.messageId = message.id;
    geoloc_gps.deviceId = message.deviceId;

    // Build the Beacon Geoloc object
    const geoloc_beacon = new Geoloc;
    geoloc_beacon.location = new loopback.GeoPoint({lat: 0, lng: 0});
    geoloc_beacon.createdAt = message.createdAt;
    geoloc_beacon.userId = message.userId;
    geoloc_beacon.messageId = message.id;
    geoloc_beacon.deviceId = message.deviceId;

    message.data_parsed.forEach((p: any) => {
      // Check if there is GPS geoloc in parsed data
      if (p.key === 'lat' && p.value >= -90 && p.value <= 90) {
        hasGpsLocation = true;
        geoloc_gps.location.lat = p.value;
      } else if (p.key === 'lng' && p.value >= -180 && p.value <= 180) {
        geoloc_gps.location.lng = p.value;
      }
      // Check if there is Beacon geoloc in parsed data
      else if (p.key === 'beaconId') {
        hasBeaconLocation = true;
        geoloc_beacon.id = p.value;
      }
      // Check if there is precision in parsed data
      else if (p.key === 'precision') {
        geoloc_beacon.precision = p.value;
      }
      // Check if there is Beacon geoloc in parsed data
      else if (p.key === 'wifi_mac_1') {
        hasWifiLocation = true;

      }
      // Check if there is Beacon geoloc in parsed data
      else if (p.key === 'wifi_mac_2') {

      }
    });

    if (hasGpsLocation) {
      geoloc_gps.type = 'gps';
      // Find or create a new Geoloc
      Geoloc.findOrCreate(
        {
          where: {
            and: [
              {type: geoloc_gps.type},
              {location: geoloc_gps.location},
              {createdAt: geoloc_gps.createdAt},
              {userId: geoloc_gps.userId},
              {messageId: geoloc_gps.messageId},
              {deviceId: geoloc_gps.deviceId}
            ]
          }
        },
        geoloc_gps,
        (err: any, geolocInstance: any, created: boolean) => {
          if (err) {
            console.error(err);
          } else {
            if (created) {
              console.log('Created geoloc as: ', geolocInstance);
              // Update device in order to trigger a real time upsert event
              this.updateDeviceLocatedAt(geolocInstance.deviceId);
            } else {
              console.log('Skipped geoloc creation.');
            }
          }
        });
    }

    if (hasBeaconLocation) {
      geoloc_beacon.type = 'beacon';
      Beacon.findOne({where: {id: geoloc_beacon.id}}, (err: any, beacon: any) => {
        if (err) {
          console.error(err);
        } else if (beacon) {
          geoloc_beacon.id = null;
          geoloc_beacon.location.lat = beacon.location.lat;
          geoloc_beacon.location.lng = beacon.location.lng;
          // Find or create a new Geoloc
          Geoloc.findOrCreate(
            {
              where: {
                and: [
                  {type: geoloc_beacon.type},
                  {location: geoloc_beacon.location},
                  {createdAt: geoloc_beacon.createdAt},
                  {userId: geoloc_beacon.userId},
                  {messageId: geoloc_beacon.messageId},
                  {deviceId: geoloc_beacon.deviceId}
                ]
              }
            },
            geoloc_beacon,
            (err: any, geolocInstance: any, created: boolean) => {
              if (err) {
                console.error(err);
              } else {
                if (created) {
                  console.log('Created geoloc as: ', geolocInstance);
                  // Update device in order to trigger a real time upsert event
                  this.updateDeviceLocatedAt(geolocInstance.deviceId);
                } else {
                  console.log('Skipped geoloc creation.');

                }
              }
            });
        }
      });
    }
  }

  postSigfox(req: any, data: any, next: Function): void {
    // Models
    const Geoloc = this.model;
    const Message = this.model.app.models.Message;
    const Alert = this.model.app.models.Alert;

    if (typeof data.geoloc === 'undefined'
      || typeof data.deviceId === 'undefined'
      || typeof data.time === 'undefined'
      || typeof data.seqNumber === 'undefined') {
      next('Missing "geoloc", "deviceId", "time" and "seqNumber"', data);
    }
    // Obtain the userId with the access token of ctx
    const userId = req.accessToken.userId;

    // Find the corresponding message in order to retrieve its message ID
    Message.findOne({
      where: {
        and: [
          {userId: userId},
          {deviceId: data.deviceId},
          {time: data.time},
          {seqNumber: data.seqNumber}
        ]
      }
    }, (err: any, messageInstance: any) => {
      if (err) {
        console.error(err);
        next(err, data);
      } else {
        if (messageInstance) {
          console.log('Found the corresponding message.');
          // Build the Geoloc object
          const geoloc = new Geoloc;
          geoloc.type = 'sigfox';
          geoloc.location = new loopback.GeoPoint(data.geoloc.location);
          geoloc.precision = data.geoloc.precision;
          geoloc.createdAt = messageInstance.createdAt;
          geoloc.userId = userId;
          geoloc.messageId = messageInstance.id;
          geoloc.deviceId = messageInstance.deviceId;

          // Trigger alerts (if any)
          Alert.triggerBySigfoxGeoloc(
            geoloc.location.lat,
            geoloc.location.lng,
            geoloc.deviceId,
            req,
            function (err: any, res: any) {
              if (err) {
                next(err, null);
              } else {
                //console.log(res);
              }
            });

          // Creating a new Geoloc
          Geoloc.create(
            geoloc,
            (err: any, geolocInstance: any) => {
              if (err) {
                console.error(err);
                next(err, geolocInstance);
              } else {
                console.log('Created geoloc as: ', geolocInstance);
                // Update device in order to trigger a real time upsert event
                this.updateDeviceLocatedAt(geolocInstance.deviceId);
                next(null, geolocInstance);
              }
            });
        } else {
          const err = 'No corresponding message found, check if UPLINK or BIDIR callbacks have been set too (on the Sigfox Backend)!';
          /**
           * TODO: Check below - OOB frame device acknowledge ?
           */
            // Saving a message anyway
          const message = new Message;

          message.userId = userId;
          message.deviceId = data.deviceId;
          message.time = data.time;
          message.seqNumber = data.seqNumber;
          message.createdAt = new Date(data.time * 1000);
          message.deviceAck = true;

          Message.create(
            message,
            (err: any, messageInstance: any) => {
              if (err) {
                console.error(err);
                next(err, messageInstance);
              } else {
                console.log('Created message as: ', messageInstance);
                // Update device in order to trigger a real time upsert event
                this.updateDeviceLocatedAt(messageInstance.deviceId);
              }
            });
          next(err, null);
        }
      }
    });
  }

  updateDeviceLocatedAt(deviceId: string) {
    // Models
    const Device = this.model.app.models.Device;

    Device.findOne({
      where: {
        id: deviceId
      }
    }, (err: any, deviceInstance: any) => {
      if (err) {
        console.error(err);
      } else {
        if (deviceInstance) {
          deviceInstance.locatedAt = new Date();
          Device.upsert(deviceInstance, (err: any, deviceUpdated: any) => {
            if (!err) {
              console.log('Updated device locatedAt date');
            }
          });
        }
      }
    });
  }
}

module.exports = Geoloc;
