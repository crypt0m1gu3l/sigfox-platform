/* tslint:disable */
import {
  Device,
  BaseStation,
  MessageProperty,
  GeoPoint
} from '../index';

declare var Object: any;
export interface MessageInterface {
  "data": string;
  "time": number;
  "RSSI"?: number;
  "seqNumber"?: number;
  "GPS"?: any;
  "geoloc_sigfox"?: GeoPoint;
  "parsed_data"?: any;
  "id"?: number;
  "DeviceId"?: string;
  "deviceId"?: string;
  "createdAt"?: Date;
  "updatedAt"?: Date;
  "baseStationId"?: string;
  Device?: Device;
  BaseStation?: BaseStation[];
  MessageProperty?: MessageProperty[];
}

export class Message implements MessageInterface {
  "data": string = '';
  "time": number = 0;
  "RSSI": number = 0;
  "seqNumber": number = 0;
  "GPS": any = <any>null;
  "geoloc_sigfox": GeoPoint = <any>null;
  "parsed_data": any = <any>null;
  "id": number = 0;
  "DeviceId": string = '';
  "deviceId": string = '';
  "createdAt": Date = new Date(0);
  "updatedAt": Date = new Date(0);
  "baseStationId": string = '';
  Device: Device = null;
  BaseStation: BaseStation[] = null;
  MessageProperty: MessageProperty[] = null;
  constructor(data?: MessageInterface) {
    Object.assign(this, data);
  }
  /**
   * The name of the model represented by this $resource,
   * i.e. `Message`.
   */
  public static getModelName() {
    return "Message";
  }
  /**
  * @method factory
  * @author Jonathan Casarrubias
  * @license MIT
  * This method creates an instance of Message for dynamic purposes.
  **/
  public static factory(data: MessageInterface): Message{
    return new Message(data);
  }
  /**
  * @method getModelDefinition
  * @author Julien Ledun
  * @license MIT
  * This method returns an object that represents some of the model
  * definitions.
  **/
  public static getModelDefinition() {
    return {
      name: 'Message',
      plural: 'Messages',
      path: 'Messages',
      properties: {
        "data": {
          name: 'data',
          type: 'string'
        },
        "time": {
          name: 'time',
          type: 'number'
        },
        "RSSI": {
          name: 'RSSI',
          type: 'number'
        },
        "seqNumber": {
          name: 'seqNumber',
          type: 'number'
        },
        "GPS": {
          name: 'GPS',
          type: 'any'
        },
        "geoloc_sigfox": {
          name: 'geoloc_sigfox',
          type: 'GeoPoint'
        },
        "parsed_data": {
          name: 'parsed_data',
          type: 'any'
        },
        "id": {
          name: 'id',
          type: 'number'
        },
        "DeviceId": {
          name: 'DeviceId',
          type: 'string'
        },
        "deviceId": {
          name: 'deviceId',
          type: 'string'
        },
        "createdAt": {
          name: 'createdAt',
          type: 'Date'
        },
        "updatedAt": {
          name: 'updatedAt',
          type: 'Date'
        },
        "baseStationId": {
          name: 'baseStationId',
          type: 'string'
        },
      },
      relations: {
        Device: {
          name: 'Device',
          type: 'Device',
          model: 'Device'
        },
        BaseStation: {
          name: 'BaseStation',
          type: 'BaseStation[]',
          model: 'BaseStation'
        },
        MessageProperty: {
          name: 'MessageProperty',
          type: 'MessageProperty[]',
          model: 'MessageProperty'
        },
      }
    }
  }
}