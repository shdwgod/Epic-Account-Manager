'use strict';

/* All user-facing text lives here so it is easy to review and change. */
const STRINGS = {
    'common.cancel': 'Cancel', 'common.done': 'Done', 'common.delete': 'Delete',

    'bar.save': 'Save current account', 'bar.settings': 'Settings',
    'toolbar.search': 'Search {n} accounts', 'toolbar.sort': 'Sort',
    'sort.used': 'Last used', 'sort.name': 'Name', 'sort.saved': 'Recently saved',
    'view.grid': 'Grid view', 'view.list': 'List view',

    'session.checking': 'Checking the Launcher…',
    'session.active': 'Signed in as {name}',
    'session.activeSub': 'This is the account the Launcher will open.',
    'session.unsaved': 'This Epic account isn’t saved yet',
    'session.unsavedSub': 'Signed in as {id}',
    'session.out': 'The Launcher isn’t signed in',
    'session.outSub': 'Sign in with “Remember me” ticked, then save the account here.',
    'session.running': 'Launcher running', 'session.closed': 'Launcher closed',
    'session.notFound': 'Launcher not found, set its path',
    'session.launch': 'Launch Epic', 'session.saveThis': 'Save this account', 'session.refresh': 'Update saved session',

    'tile.switch': 'Switch to {name}', 'tile.more': 'More options',
    'tile.used': 'Used {when}', 'tile.neverUsed': 'Not used yet',
    'tile.active': 'Active',
    'tile.legacy': 'Saved with a password by an older version. Sign in to this account and use “Update saved session”.',
    'tile.pinned': 'Pinned', 'tile.add': 'Save current account',

    'menu.edit': 'Edit profile', 'menu.pin': 'Pin to top', 'menu.unpin': 'Unpin',
    'menu.refresh': 'Update saved session',

    'empty.title': 'No saved accounts yet',
    'empty.text': 'Sign in to the Epic Games Launcher, then save the account here. Repeat for every account you use.',
    'empty.step1': 'Sign in to the Launcher with “Remember me” ticked.',
    'empty.step2': 'Press “Save current account”. It is named after your Epic display name.',
    'empty.step3': 'Sign out, sign in to the next account and save it too.',
    'empty.none': 'No accounts match “{q}”', 'empty.clear': 'Clear search',

    'save.name': 'Profile name',
    'save.busy': 'Closing Epic and saving the profile…', 'save.done': 'Saved “{name}”', 'save.updated': 'Updated “{name}”',
    'save.wrongAccount': 'The Launcher is signed in to another account. Sign in to “{name}” first.',
    'save.needSignIn': 'The Launcher isn’t signed in. Sign in first.',
    'name.enter': 'Enter a name.', 'name.taken': 'A profile with this name already exists.', 'switch.busy': 'Switching to {name}…', 'switch.busySub': 'Closing the Launcher and restoring the session.',
    'switch.done': 'Switched to “{name}”', 'switch.launchNow': 'Launch Epic',

    'edit.title': 'Edit profile', 'edit.picture': 'Picture', 'edit.choose': 'Choose picture…', 'edit.remove': 'Remove picture',
    'edit.color': 'Colour', 'edit.auto': 'Automatic', 'edit.confirm': 'Save changes', 'edit.done': 'Profile updated',
    'delete.title': 'Delete profile', 'delete.text': 'Delete “{name}”? This cannot be undone.', 'delete.done': 'Deleted “{name}”',
    'pin.on': '“{name}” pinned', 'pin.off': '“{name}” unpinned',

    'settings.title': 'Settings',
    'settings.launch': 'Launch Epic after switching', 'settings.launchText': 'Start the Launcher with the new account.',
    'settings.path': 'Launcher', 'settings.notFound': 'Launcher not found', 'settings.browse': 'Browse…', 'settings.auto': 'Detect automatically',
    'settings.data': 'Open data folder', 'settings.about': 'Version {v}. Unofficial community project, not affiliated with Epic Games, Inc.',
    'settings.keys': 'Shortcuts: Ctrl+F search, Ctrl+N save account, Ctrl+, settings, arrow keys move between accounts.',

    'rel.now': 'just now',
    'tile.switchHint': 'Switch',
    'edit.imageError': 'Could not read this image.',
    'app.apiMissing': 'This window must run inside Epic Account Manager.',
    'app.fatal': 'Something went wrong: {msg}',
};

const I18N = {
  t(key, vars) {
    let s = STRINGS[key] || key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  },
};
