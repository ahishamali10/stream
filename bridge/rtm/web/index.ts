/*
********************************************
 Copyright © 2021 Agora Lab, Inc., all rights reserved.
 AppBuilder and all associated components, source code, APIs, services, and documentation
 (the “Materials”) are owned by Agora Lab, Inc. and its licensors. The Materials may not be
 accessed, used, modified, or distributed for any purpose without a license from Agora Lab, Inc.
 Use without a license or in violation of any license terms and conditions (including use for
 any purpose competitive to Agora Lab, Inc.’s business) is strictly prohibited. For more
 information visit https://appbuilder.agora.io.
*********************************************
*/
// @ts-nocheck
import {
  ChannelAttributeOptions,
  RtmAttribute,
  RtmChannelAttribute,
  Subscription,
} from 'agora-react-native-rtm/lib/typescript/src';
import {RtmClientEvents} from 'agora-react-native-rtm/lib/typescript/src/RtmEngine';
import AgoraRTM, {VERSION} from 'agora-rtm-sdk';
import RtmClient from 'agora-react-native-rtm';
import {LogSource, logger} from '../../../src/logger/AppBuilderLogger';
// export {RtmAttribute}
//
interface RtmAttributePlaceholder {}
export {RtmAttributePlaceholder as RtmAttribute};

type callbackType = (args?: any) => void;

export default class RtmEngine {
  public appId: string;
  public client: RtmClient;
  public channelMap = new Map<string, any>([]);
  public remoteInvititations = new Map<string, any>([]);
  public localInvititations = new Map<string, any>([]);
  public channelEventsMap = new Map<string, any>([
    ['channelMessageReceived', () => null],
    ['channelMemberJoined', () => null],
    ['channelMemberLeft', () => null],
  ]);
  public clientEventsMap = new Map<string, any>([
    ['connectionStateChanged', () => null],
    ['messageReceived', () => null],
    ['remoteInvitationReceived', () => null],
    ['tokenExpired', () => null],
  ]);
  public localInvitationEventsMap = new Map<string, any>([
    ['localInvitationAccepted', () => null],
    ['localInvitationCanceled', () => null],
    ['localInvitationFailure', () => null],
    ['localInvitationReceivedByPeer', () => null],
    ['localInvitationRefused', () => null],
  ]);
  public remoteInvitationEventsMap = new Map<string, any>([
    ['remoteInvitationAccepted', () => null],
    ['remoteInvitationCanceled', () => null],
    ['remoteInvitationFailure', () => null],
    ['remoteInvitationRefused', () => null],
  ]);
  constructor() {
    this.appId = '';
    logger.debug(LogSource.AgoraSDK, 'Log', 'Using RTM Bridge');
  }

  on(event: any, listener: any) {
    if (
      event === 'channelMessageReceived' ||
      event === 'channelMemberJoined' ||
      event === 'channelMemberLeft'
    ) {
      this.channelEventsMap.set(event, listener);
    } else if (
      event === 'connectionStateChanged' ||
      event === 'messageReceived' ||
      event === 'remoteInvitationReceived' ||
      event === 'tokenExpired'
    ) {
      this.clientEventsMap.set(event, listener);
    } else if (
      event === 'localInvitationAccepted' ||
      event === 'localInvitationCanceled' ||
      event === 'localInvitationFailure' ||
      event === 'localInvitationReceivedByPeer' ||
      event === 'localInvitationRefused'
    ) {
      this.localInvitationEventsMap.set(event, listener);
    } else if (
      event === 'remoteInvitationAccepted' ||
      event === 'remoteInvitationCanceled' ||
      event === 'remoteInvitationFailure' ||
      event === 'remoteInvitationRefused'
    ) {
      this.remoteInvitationEventsMap.set(event, listener);
    }
  }

  createClient(APP_ID: string) {
    this.appId = APP_ID;
    this.client = AgoraRTM.createInstance(this.appId);

    if ($config.GEO_FENCING) {
      try {
        //include area is comma seperated value
        let includeArea = $config.GEO_FENCING_INCLUDE_AREA
          ? $config.GEO_FENCING_INCLUDE_AREA
          : AREAS.GLOBAL;

        //exclude area is single value
        let excludeArea = $config.GEO_FENCING_EXCLUDE_AREA
          ? $config.GEO_FENCING_EXCLUDE_AREA
          : '';

        includeArea = includeArea?.split(',');

        //pass excludedArea if only its provided
        if (excludeArea) {
          AgoraRTM.setArea({
            areaCodes: includeArea,
            excludedArea: excludeArea,
          });
        }
        //otherwise we can pass area directly
        else {
          AgoraRTM.setArea({areaCodes: includeArea});
        }
      } catch (setAeraError) {
        console.log('error on RTM setArea', setAeraError);
      }
    }

    window.rtmClient = this.client;

    this.client.on('ConnectionStateChanged', (state, reason) => {
      this.clientEventsMap.get('connectionStateChanged')({state, reason});
    });

    this.client.on('MessageFromPeer', (msg, uid, msgProps) => {
      this.clientEventsMap.get('messageReceived')({
        text: msg.text,
        ts: msgProps.serverReceivedTs,
        offline: msgProps.isOfflineMessage,
        peerId: uid,
      });
    });

    this.client.on('RemoteInvitationReceived', (remoteInvitation: any) => {
      this.remoteInvititations.set(remoteInvitation.callerId, remoteInvitation);
      this.clientEventsMap.get('remoteInvitationReceived')({
        callerId: remoteInvitation.callerId,
        content: remoteInvitation.content,
        state: remoteInvitation.state,
        channelId: remoteInvitation.channelId,
        response: remoteInvitation.response,
      });

      remoteInvitation.on('RemoteInvitationAccepted', () => {
        this.remoteInvitationEventsMap.get('RemoteInvitationAccepted')({
          callerId: remoteInvitation.callerId,
          content: remoteInvitation.content,
          state: remoteInvitation.state,
          channelId: remoteInvitation.channelId,
          response: remoteInvitation.response,
        });
      });

      remoteInvitation.on('RemoteInvitationCanceled', (content: string) => {
        this.remoteInvitationEventsMap.get('remoteInvitationCanceled')({
          callerId: remoteInvitation.callerId,
          content: content,
          state: remoteInvitation.state,
          channelId: remoteInvitation.channelId,
          response: remoteInvitation.response,
        });
      });

      remoteInvitation.on('RemoteInvitationFailure', (reason: string) => {
        this.remoteInvitationEventsMap.get('remoteInvitationFailure')({
          callerId: remoteInvitation.callerId,
          content: remoteInvitation.content,
          state: remoteInvitation.state,
          channelId: remoteInvitation.channelId,
          response: remoteInvitation.response,
          code: -1, //Web sends string, RN expect number but can't find enum
        });
      });

      remoteInvitation.on('RemoteInvitationRefused', () => {
        this.remoteInvitationEventsMap.get('remoteInvitationRefused')({
          callerId: remoteInvitation.callerId,
          content: remoteInvitation.content,
          state: remoteInvitation.state,
          channelId: remoteInvitation.channelId,
          response: remoteInvitation.response,
        });
      });
    });

    this.client.on('TokenExpired', () => {
      this.clientEventsMap.get('tokenExpired')({}); //RN expect evt: any
    });
  }

  async login(loginParam: {uid: string; token?: string}): Promise<any> {
    return this.client.login(loginParam);
  }

  async logout(): Promise<any> {
    return await this.client.logout();
  }

  async joinChannel(channelId: string): Promise<any> {
    this.channelMap.set(channelId, this.client.createChannel(channelId));
    this.channelMap
      .get(channelId)
      .on('ChannelMessage', (msg: {text: string}, uid: string, messagePros) => {
        let text = msg.text;
        let ts = messagePros.serverReceivedTs;
        this.channelEventsMap.get('channelMessageReceived')({
          uid,
          channelId,
          text,
          ts,
        });
      });
    this.channelMap.get(channelId).on('MemberJoined', (uid: string) => {
      this.channelEventsMap.get('channelMemberJoined')({uid, channelId});
    });
    this.channelMap.get(channelId).on('MemberLeft', (uid: string) => {
      console.log('Member Left', this.channelEventsMap);
      this.channelEventsMap.get('channelMemberLeft')({uid});
    });
    this.channelMap
      .get(channelId)
      .on('AttributesUpdated', (attributes: RtmChannelAttribute) => {
        /**
         * a) Kindly note the below event listener 'channelAttributesUpdated' expects type
         *    RtmChannelAttribute[] (array of objects [{key: 'valueOfKey', value: 'valueOfValue}])
         *    whereas the above listener 'AttributesUpdated' receives attributes in object form
         *    {[valueOfKey]: valueOfValue} of type RtmChannelAttribute
         * b) Hence in this bridge the data should be modified to keep in sync with both the
         *    listeners for web and listener for native
         */
        /**
         * 1. Loop through object
         * 2. Create a object {key: "", value: ""} and push into array
         * 3. Return the Array
         */
        const channelAttributes = Object.keys(attributes).reduce((acc, key) => {
          const {value, lastUpdateTs, lastUpdateUserId} = attributes[key];
          acc.push({key, value, lastUpdateTs, lastUpdateUserId});
          return acc;
        }, []);

        this.channelEventsMap.get('ChannelAttributesUpdated')(
          channelAttributes,
        );
      });

    return this.channelMap.get(channelId).join();
  }

  async leaveChannel(channelId: string): Promise<any> {
    if (this.channelMap.get(channelId)) {
      return this.channelMap.get(channelId).leave();
    } else {
      Promise.reject('Wrong channel');
    }
  }

  async sendMessageByChannelId(channel: string, message: string): Promise<any> {
    if (this.channelMap.get(channel)) {
      return this.channelMap.get(channel).sendMessage({text: message});
    } else {
      console.log(this.channelMap, channel);
      Promise.reject('Wrong channel');
    }
  }

  destroyClient() {
    console.log('Destroy called');
    this.channelEventsMap.forEach((callback, event) => {
      this.client.off(event, callback);
    });
    this.channelEventsMap.clear();
    this.channelMap.clear();
    this.clientEventsMap.clear();
    this.remoteInvitationEventsMap.clear();
    this.localInvitationEventsMap.clear();
  }

  async getChannelMembersBychannelId(channel: string) {
    if (this.channelMap.get(channel)) {
      let memberArray: Array<any> = [];
      let currentChannel = this.channelMap.get(channel);
      await currentChannel.getMembers().then((arr: Array<number>) => {
        arr.map((elem: number) => {
          memberArray.push({
            channelId: channel,
            uid: elem,
          });
        });
      });
      return {members: memberArray};
    } else {
      Promise.reject('Wrong channel');
    }
  }

  async queryPeersOnlineStatus(uid: Array<String>) {
    let peerArray: Array<any> = [];
    await this.client.queryPeersOnlineStatus(uid).then(list => {
      Object.entries(list).forEach(value => {
        peerArray.push({
          online: value[1],
          uid: value[0],
        });
      });
    });
    return {items: peerArray};
  }

  async renewToken(token: string) {
    return this.client.renewToken(token);
  }

  async getUserAttributesByUid(uid: string) {
    let response = {};
    await this.client
      .getUserAttributes(uid)
      .then((attributes: string) => {
        response = {attributes, uid};
      })
      .catch((e: any) => {
        Promise.reject(e);
      });
    return response;
  }

  async getChannelAttributes(channelId: string) {
    let response = {};
    await this.client
      .getChannelAttributes(channelId)
      .then((attributes: RtmChannelAttribute) => {
        /**
         *  Here the attributes received are in the format {[valueOfKey]: valueOfValue} of type RtmChannelAttribute
         *  We need to convert it into (array of objects [{key: 'valueOfKey', value: 'valueOfValue}])
        /**
         * 1. Loop through object
         * 2. Create a object {key: "", value: ""} and push into array
         * 3. Return the Array
         */
        const channelAttributes = Object.keys(attributes).reduce((acc, key) => {
          const {value, lastUpdateTs, lastUpdateUserId} = attributes[key];
          acc.push({key, value, lastUpdateTs, lastUpdateUserId});
          return acc;
        }, []);
        response = channelAttributes;
      })
      .catch((e: any) => {
        Promise.reject(e);
      });
    return response;
  }

  async removeAllLocalUserAttributes() {
    return this.client.clearLocalUserAttributes();
  }

  async removeLocalUserAttributesByKeys(keys: string[]) {
    return this.client.deleteLocalUserAttributesByKeys(keys);
  }

  async replaceLocalUserAttributes(attributes: string[]) {
    let formattedAttributes: any = {};
    attributes.map(attribute => {
      let key = Object.values(attribute)[0];
      let value = Object.values(attribute)[1];
      formattedAttributes[key] = value;
    });
    return this.client.setLocalUserAttributes({...formattedAttributes});
  }

  async setLocalUserAttributes(attributes: string[]) {
    let formattedAttributes: any = {};
    attributes.map(attribute => {
      let key = Object.values(attribute)[0];
      let value = Object.values(attribute)[1];
      formattedAttributes[key] = value;
      // console.log('!!!!formattedAttributes', formattedAttributes, key, value);
    });
    return this.client.setLocalUserAttributes({...formattedAttributes});
  }

  async addOrUpdateLocalUserAttributes(attributes: RtmAttribute[]) {
    let formattedAttributes: any = {};
    attributes.map(attribute => {
      let key = Object.values(attribute)[0];
      let value = Object.values(attribute)[1];
      formattedAttributes[key] = value;
    });
    return this.client.addOrUpdateLocalUserAttributes({...formattedAttributes});
  }

  async addOrUpdateChannelAttributes(
    channelId: string,
    attributes: RtmChannelAttribute[],
    option: ChannelAttributeOptions,
  ): Promise<void> {
    let formattedAttributes: any = {};
    attributes.map(attribute => {
      let key = Object.values(attribute)[0];
      let value = Object.values(attribute)[1];
      formattedAttributes[key] = value;
    });
    return this.client.addOrUpdateChannelAttributes(
      channelId,
      {...formattedAttributes},
      option,
    );
  }

  async sendLocalInvitation(invitationProps: any) {
    let invite = this.client.createLocalInvitation(invitationProps.uid);
    this.localInvititations.set(invitationProps.uid, invite);
    invite.content = invitationProps.content;

    invite.on('LocalInvitationAccepted', (response: string) => {
      this.localInvitationEventsMap.get('localInvitationAccepted')({
        calleeId: invite.calleeId,
        content: invite.content,
        state: invite.state,
        channelId: invite.channelId,
        response,
      });
    });

    invite.on('LocalInvitationCanceled', () => {
      this.localInvitationEventsMap.get('localInvitationCanceled')({
        calleeId: invite.calleeId,
        content: invite.content,
        state: invite.state,
        channelId: invite.channelId,
        response: invite.response,
      });
    });

    invite.on('LocalInvitationFailure', (reason: string) => {
      this.localInvitationEventsMap.get('localInvitationFailure')({
        calleeId: invite.calleeId,
        content: invite.content,
        state: invite.state,
        channelId: invite.channelId,
        response: invite.response,
        code: -1, //Web sends string, RN expect number but can't find enum
      });
    });

    invite.on('LocalInvitationReceivedByPeer', () => {
      this.localInvitationEventsMap.get('localInvitationReceivedByPeer')({
        calleeId: invite.calleeId,
        content: invite.content,
        state: invite.state,
        channelId: invite.channelId,
        response: invite.response,
      });
    });

    invite.on('LocalInvitationRefused', (response: string) => {
      this.localInvitationEventsMap.get('localInvitationRefused')({
        calleeId: invite.calleeId,
        content: invite.content,
        state: invite.state,
        channelId: invite.channelId,
        response: response,
      });
    });
    return invite.send();
  }

  async sendMessageToPeer(AgoraPeerMessage: {
    peerId: string;
    offline: boolean;
    text: string;
  }) {
    return this.client.sendMessageToPeer(
      {text: AgoraPeerMessage.text},
      AgoraPeerMessage.peerId,
    );
    //check promise result
  }

  async acceptRemoteInvitation(remoteInvitationProps: {
    uid: string;
    response?: string;
    channelId: string;
  }) {
    let invite = this.remoteInvititations.get(remoteInvitationProps.uid);
    // console.log(invite);
    // console.log(this.remoteInvititations);
    // console.log(remoteInvitationProps.uid);
    return invite.accept();
  }

  async refuseRemoteInvitation(remoteInvitationProps: {
    uid: string;
    response?: string;
    channelId: string;
  }) {
    return this.remoteInvititations.get(remoteInvitationProps.uid).refuse();
  }

  async cancelLocalInvitation(LocalInvitationProps: {
    uid: string;
    content?: string;
    channelId?: string;
  }) {
    console.log(this.localInvititations.get(LocalInvitationProps.uid));
    return this.localInvititations.get(LocalInvitationProps.uid).cancel();
  }

  getSdkVersion(callback: (version: string) => void) {
    callback(VERSION);
  }

  addListener<EventType extends keyof RtmClientEvents>(
    event: EventType,
    listener: RtmClientEvents[EventType],
  ): Subscription {
    if (event === 'ChannelAttributesUpdated') {
      this.channelEventsMap.set(event, listener as callbackType);
    }
    return {
      remove: () => {
        console.log(
          'Use destroy method to remove all the event listeners from the RtcEngine instead.',
        );
      },
    };
  }
}
