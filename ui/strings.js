'use strict';

/* All user-facing text lives here so it is easy to review and change. */
const STRINGS = {
    'common.cancel': 'Cancel', 'common.done': 'Done', 'common.delete': 'Delete',

    'page.title': 'Choose an account', 'bar.save': 'Save current account', 'bar.settings': 'Settings',
    'toolbar.search': 'Search accounts',
    'manage.enter': 'Manage accounts', 'manage.exit': 'Done', 'manage.title': 'Manage accounts',

    'session.checking': 'Checking the Launcher…',
    'session.active': 'Signed in as {name}',
    'session.unsaved': 'Signed in as {id}, not saved yet',
    'session.out': 'The Launcher isn’t signed in',
    'session.running': 'Launcher running', 'session.closed': 'Launcher closed',
    'session.notFound': 'Launcher not found',
    'session.saveThis': 'Save this account', 'session.refresh': 'Update saved session',

    'tile.switch': 'Switch to {name}', 'tile.more': 'More options', 'tile.edit': 'Edit {name}',
    'tile.used': 'Used {when}', 'tile.neverUsed': 'Not used yet',
    'tile.active': 'Active',
    'tile.legacy': 'Saved with a password by an older version. Sign in to this account and use “Update saved session”.',
    'tile.legacyShort': 'Save it again',
    'tile.switchCue': 'Switch',
    'tile.pinned': 'Pinned',
    'tile.add': 'Add account', 'tile.saveNamed': 'Save {name}',

    'menu.edit': 'Edit profile', 'menu.pin': 'Pin to front', 'menu.unpin': 'Unpin',
    'menu.refresh': 'Update saved session',

    'empty.title': 'No saved accounts yet',
    'empty.text': 'Sign in to the Epic Games Launcher, then save the account here. Repeat for every account you use.',
    'empty.step1': 'Sign in to the Launcher with “Remember me” ticked.',
    'empty.step2': 'Come back here and save the account. It is named after your Epic display name.',
    'empty.step3': 'Sign out, sign in to the next account and save it too.',
    'empty.none': 'No accounts match “{q}”', 'empty.clear': 'Clear search',
    'add.title': 'Add an account',

    'save.name': 'Profile name',
    'save.busy': 'Closing Epic and saving the profile…', 'save.done': 'Saved “{name}”', 'save.updated': 'Updated “{name}”',
    'save.wrongAccount': 'The Launcher is signed in to another account. Sign in to “{name}” first.',
    'save.needSignIn': 'The Launcher isn’t signed in. Sign in first.',
    'name.enter': 'Enter a name.', 'name.taken': 'A profile with this name already exists.', 'switch.busy': 'Switching to {name}…', 'switch.busySub': 'Closing the Launcher and restoring the session.',
    'switch.done': 'Switched to “{name}”',

    'edit.title': 'Edit profile', 'edit.picture': 'Picture', 'edit.choose': 'Choose picture…', 'edit.remove': 'Remove picture',
    'edit.color': 'Colour', 'edit.auto': 'Auto', 'edit.confirm': 'Save changes', 'edit.done': 'Profile updated',
    'delete.title': 'Delete profile', 'delete.text': 'Delete “{name}”? This cannot be undone.', 'delete.done': 'Deleted “{name}”',
    'pin.on': '“{name}” pinned', 'pin.off': '“{name}” unpinned',

    'settings.title': 'Settings', 'settings.back': 'Back',
    'settings.general': 'General',
    'settings.launch': 'Open Epic Games Launcher after switching', 'settings.launchText': 'Starts the Launcher with the new account already signed in.',
    'settings.order': 'Order accounts by', 'settings.orderText': 'Pinned accounts always stay in front.',
    'sort.used': 'Last used', 'sort.name': 'Name', 'sort.saved': 'Recently saved',
    'settings.launcherSection': 'Epic Games Launcher',
    'settings.status.auto': 'Found automatically', 'settings.status.custom': 'Using the file you chose', 'settings.status.missing': 'Launcher not found',
    'settings.notFound': 'Launcher not found',
    'settings.missingHelp': 'Choose EpicGamesLauncher.exe so this app can start it.',
    'settings.choose': 'Choose file…', 'settings.auto': 'Use automatic',
    'settings.dataSection': 'Your data',
    'settings.dataTitle': 'Saved accounts', 'settings.dataText': 'Stored only on this PC and protected by Windows.',
    'settings.openData': 'Open folder',

    'rel.now': 'just now',
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
