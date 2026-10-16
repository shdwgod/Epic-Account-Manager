'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, arg) => ipcRenderer.invoke(channel, arg);

contextBridge.exposeInMainWorld('api', {
  state: () => call('state'),
  status: () => call('status'),
  save: (name, password) => call('save', { name, password }),
  switchTo: (name, password) => call('switch', { name, password }),
  rename: (oldName, newName) => call('rename', { oldName, newName }),
  setLock: (name, password, newPassword) => call('setLock', { name, password, newPassword }),
  remove: (name) => call('remove', { name }),
  settings: (patch) => call('settings', patch),
  browse: () => call('browse'),
  launch: () => call('launch'),
  pickImage: () => call('pickImage'),
  setAvatar: (name, avatar) => call('setAvatar', { name, avatar }),
  openDataFolder: () => call('openDataFolder'),
});