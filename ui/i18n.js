'use strict';

/* Translations. English is the source language; Polish is picked automatically
   when the system language is Polish (or chosen in Settings). */
const STRINGS = {
  en: {
    'app.name': 'Epic Account Manager',
    'common.cancel': 'Cancel', 'common.done': 'Done', 'common.delete': 'Delete',
    'common.never': 'Never', 'common.password': 'Password / PIN', 'common.repeat': 'Repeat password',

    'bar.save': 'Save current account', 'bar.settings': 'Settings',
    'toolbar.search': 'Search {n} accounts', 'toolbar.sort': 'Sort',
    'sort.used': 'Last used', 'sort.name': 'Name', 'sort.saved': 'Recently saved',
    'view.grid': 'Grid view', 'view.list': 'List view',

    'session.checking': 'Checking the Launcher…',
    'session.active': 'Signed in as {name}',
    'session.activeSub': 'This is the account the Launcher will open.',
    'session.unsaved': 'This Epic account isn’t saved yet',
    'session.unsavedSub': 'Account {id}',
    'session.out': 'The Launcher isn’t signed in',
    'session.outSub': 'Sign in with “Remember me” ticked, then save the account here.',
    'session.running': 'Launcher running', 'session.closed': 'Launcher closed',
    'session.notFound': 'Launcher not found, set its path',
    'session.launch': 'Launch Epic', 'session.saveThis': 'Save this account', 'session.refresh': 'Update saved session',

    'tile.switch': 'Switch to {name}', 'tile.more': 'More options',
    'tile.used': 'Used {when}', 'tile.neverUsed': 'Not used yet',
    'tile.active': 'Active', 'tile.locked': 'Password protected', 'tile.open': 'No password, protected by Windows only',
    'tile.pinned': 'Pinned', 'tile.add': 'Save current account',

    'menu.edit': 'Edit profile', 'menu.pin': 'Pin to top', 'menu.unpin': 'Unpin',
    'menu.refresh': 'Update saved session', 'menu.addLock': 'Set password', 'menu.removeLock': 'Remove password',

    'empty.title': 'No saved accounts yet',
    'empty.text': 'Sign in to the Epic Games Launcher, then save the account here. Repeat for every account you use.',
    'empty.step1': 'Sign in to the Launcher with “Remember me” ticked.',
    'empty.step2': 'Press “Save current account” and name it.',
    'empty.step3': 'Sign out, sign in to the next account and save it too.',
    'empty.none': 'No accounts match “{q}”', 'empty.clear': 'Clear search',

    'save.title': 'Save current account', 'save.update': 'Update saved session',
    'save.signedIn': 'The Launcher is signed in as {id}.',
    'save.notSignedIn': 'The Launcher isn’t signed in. Sign in with “Remember me” ticked first.',
    'save.same': 'This account is already saved as “{name}”. Saving updates its session.',
    'save.name': 'Profile name', 'save.namePh': 'e.g. Main account',
    'save.replace': 'A profile called “{name}” already exists and will be replaced.',
    'save.mismatch': 'The Launcher is signed in to a different account than “{name}”. Saving would replace this profile with that account.',
    'save.protection': 'Protection', 'save.usePw': 'Password', 'save.noPw': 'No password',
    'save.pwRequired': 'A password is required (change this in Settings).',
    'save.pwHint': 'Needed every time you switch to this profile.',
    'save.noPwHint': 'One-click switching. Protected by your Windows account only.',
    'save.confirm': 'Save account', 'save.confirmUpdate': 'Update session', 'save.confirmReplace': 'Replace profile',
    'save.busy': 'Closing Epic and saving the profile…', 'save.done': 'Saved “{name}”', 'save.updated': 'Updated “{name}”',
    'save.wrongAccount': 'The Launcher is signed in to another account. Sign in to “{name}” first.',
    'save.needSignIn': 'The Launcher isn’t signed in. Sign in first.',
    'pw.weak': 'Weak', 'pw.ok': 'OK', 'pw.strong': 'Strong',
    'pw.short': 'Use at least 4 characters.', 'pw.mismatch': 'Passwords do not match.', 'pw.enter': 'Enter the password.',
    'name.enter': 'Enter a name.', 'name.taken': 'A profile with this name already exists.',

    'switch.title': 'Switch to {name}', 'switch.hint': 'Enter the password you set for this profile.',
    'switch.confirm': 'Switch', 'switch.busy': 'Switching to {name}…', 'switch.busySub': 'Closing the Launcher and restoring the session.',
    'switch.done': 'Switched to “{name}”', 'switch.launchNow': 'Launch Epic',

    'edit.title': 'Edit profile', 'edit.picture': 'Picture', 'edit.choose': 'Choose picture…', 'edit.remove': 'Remove picture',
    'edit.color': 'Colour', 'edit.auto': 'Automatic', 'edit.confirm': 'Save changes', 'edit.done': 'Profile updated',
    'lock.removeTitle': 'Remove password from {name}',
    'lock.removeHint': 'Switching will work in one click. The profile stays protected by your Windows account only.',
    'lock.current': 'Current password', 'lock.remove': 'Remove password', 'lock.removed': '“{name}” no longer needs a password',
    'lock.addTitle': 'Set a password for {name}', 'lock.add': 'Set password', 'lock.added': '“{name}” is now password protected',
    'lock.busy': 'Updating the profile…',
    'delete.title': 'Delete profile', 'delete.text': 'Delete “{name}”? This cannot be undone.', 'delete.done': 'Deleted “{name}”',
    'pin.on': '“{name}” pinned', 'pin.off': '“{name}” unpinned',

    'settings.title': 'Settings',
    'settings.requirePw': 'Require a password', 'settings.requirePwText': 'Turn off to save new profiles without a password and switch with one click.',
    'settings.launch': 'Launch Epic after switching', 'settings.launchText': 'Start the Launcher with the new account.',
    'settings.path': 'Launcher', 'settings.notFound': 'Launcher not found', 'settings.browse': 'Browse…', 'settings.auto': 'Detect automatically',
    'settings.language': 'Language', 'settings.langAuto': 'Auto',
    'settings.data': 'Open data folder', 'settings.about': 'Version {v}. Unofficial community project, not affiliated with Epic Games, Inc.',
    'settings.keys': 'Shortcuts: Ctrl+F search, Ctrl+N save account, Ctrl+, settings, arrow keys move between accounts.',

    'rel.now': 'just now',
  },

  pl: {
    'app.name': 'Epic Account Manager',
    'common.cancel': 'Anuluj', 'common.done': 'Gotowe', 'common.delete': 'Usuń',
    'common.never': 'Nigdy', 'common.password': 'Hasło / PIN', 'common.repeat': 'Powtórz hasło',

    'bar.save': 'Zapisz bieżące konto', 'bar.settings': 'Ustawienia',
    'toolbar.search': 'Szukaj wśród {n} kont', 'toolbar.sort': 'Sortowanie',
    'sort.used': 'Ostatnio używane', 'sort.name': 'Nazwa', 'sort.saved': 'Ostatnio zapisane',
    'view.grid': 'Widok kafelków', 'view.list': 'Widok listy',

    'session.checking': 'Sprawdzam launcher…',
    'session.active': 'Zalogowano jako {name}',
    'session.activeSub': 'Na to konto otworzy się launcher.',
    'session.unsaved': 'To konto Epic nie jest jeszcze zapisane',
    'session.unsavedSub': 'Konto {id}',
    'session.out': 'Launcher nie jest zalogowany',
    'session.outSub': 'Zaloguj się z zaznaczonym „Zapamiętaj mnie”, a potem zapisz konto tutaj.',
    'session.running': 'Launcher działa', 'session.closed': 'Launcher zamknięty',
    'session.notFound': 'Nie znaleziono launchera, ustaw ścieżkę',
    'session.launch': 'Uruchom Epic', 'session.saveThis': 'Zapisz to konto', 'session.refresh': 'Odśwież zapisaną sesję',

    'tile.switch': 'Przełącz na {name}', 'tile.more': 'Więcej opcji',
    'tile.used': 'Użyte {when}', 'tile.neverUsed': 'Jeszcze nie używane',
    'tile.active': 'Aktywne', 'tile.locked': 'Chronione hasłem', 'tile.open': 'Bez hasła, chronione tylko przez Windows',
    'tile.pinned': 'Przypięte', 'tile.add': 'Zapisz bieżące konto',

    'menu.edit': 'Edytuj profil', 'menu.pin': 'Przypnij na górze', 'menu.unpin': 'Odepnij',
    'menu.refresh': 'Odśwież zapisaną sesję', 'menu.addLock': 'Ustaw hasło', 'menu.removeLock': 'Usuń hasło',

    'empty.title': 'Brak zapisanych kont',
    'empty.text': 'Zaloguj się w Epic Games Launcher i zapisz tu konto. Powtórz dla każdego konta, z którego korzystasz.',
    'empty.step1': 'Zaloguj się w launcherze z zaznaczonym „Zapamiętaj mnie”.',
    'empty.step2': 'Kliknij „Zapisz bieżące konto” i nadaj mu nazwę.',
    'empty.step3': 'Wyloguj się, zaloguj na kolejne konto i zapisz je tak samo.',
    'empty.none': 'Brak kont pasujących do „{q}”', 'empty.clear': 'Wyczyść wyszukiwanie',

    'save.title': 'Zapisz bieżące konto', 'save.update': 'Odśwież zapisaną sesję',
    'save.signedIn': 'Launcher jest zalogowany jako {id}.',
    'save.notSignedIn': 'Launcher nie jest zalogowany. Najpierw zaloguj się z zaznaczonym „Zapamiętaj mnie”.',
    'save.same': 'To konto jest już zapisane jako „{name}”. Zapis odświeży jego sesję.',
    'save.name': 'Nazwa profilu', 'save.namePh': 'np. Główne konto',
    'save.replace': 'Profil o nazwie „{name}” już istnieje i zostanie zastąpiony.',
    'save.mismatch': 'Launcher jest zalogowany na inne konto niż „{name}”. Zapis zastąpi ten profil tamtym kontem.',
    'save.protection': 'Ochrona', 'save.usePw': 'Hasło', 'save.noPw': 'Bez hasła',
    'save.pwRequired': 'Hasło jest wymagane (zmienisz to w Ustawieniach).',
    'save.pwHint': 'Wymagane przy każdym przełączeniu na ten profil.',
    'save.noPwHint': 'Przełączanie jednym kliknięciem. Chronione tylko przez konto Windows.',
    'save.confirm': 'Zapisz konto', 'save.confirmUpdate': 'Odśwież sesję', 'save.confirmReplace': 'Zastąp profil',
    'save.busy': 'Zamykam Epic i zapisuję profil…', 'save.done': 'Zapisano „{name}”', 'save.updated': 'Odświeżono „{name}”',
    'save.wrongAccount': 'Launcher jest zalogowany na inne konto. Najpierw zaloguj się na „{name}”.',
    'save.needSignIn': 'Launcher nie jest zalogowany. Najpierw się zaloguj.',
    'pw.weak': 'Słabe', 'pw.ok': 'Średnie', 'pw.strong': 'Mocne',
    'pw.short': 'Użyj co najmniej 4 znaków.', 'pw.mismatch': 'Hasła nie są takie same.', 'pw.enter': 'Wpisz hasło.',
    'name.enter': 'Wpisz nazwę.', 'name.taken': 'Profil o tej nazwie już istnieje.',

    'switch.title': 'Przełącz na {name}', 'switch.hint': 'Wpisz hasło ustawione dla tego profilu.',
    'switch.confirm': 'Przełącz', 'switch.busy': 'Przełączam na {name}…', 'switch.busySub': 'Zamykam launcher i przywracam sesję.',
    'switch.done': 'Przełączono na „{name}”', 'switch.launchNow': 'Uruchom Epic',

    'edit.title': 'Edytuj profil', 'edit.picture': 'Zdjęcie', 'edit.choose': 'Wybierz zdjęcie…', 'edit.remove': 'Usuń zdjęcie',
    'edit.color': 'Kolor', 'edit.auto': 'Automatyczny', 'edit.confirm': 'Zapisz zmiany', 'edit.done': 'Zaktualizowano profil',
    'lock.removeTitle': 'Usuń hasło z profilu {name}',
    'lock.removeHint': 'Przełączanie będzie działać jednym kliknięciem. Profil pozostanie chroniony tylko przez konto Windows.',
    'lock.current': 'Obecne hasło', 'lock.remove': 'Usuń hasło', 'lock.removed': '„{name}” nie wymaga już hasła',
    'lock.addTitle': 'Ustaw hasło dla profilu {name}', 'lock.add': 'Ustaw hasło', 'lock.added': '„{name}” jest teraz chroniony hasłem',
    'lock.busy': 'Aktualizuję profil…',
    'delete.title': 'Usuń profil', 'delete.text': 'Usunąć „{name}”? Tej operacji nie można cofnąć.', 'delete.done': 'Usunięto „{name}”',
    'pin.on': 'Przypięto „{name}”', 'pin.off': 'Odpięto „{name}”',

    'settings.title': 'Ustawienia',
    'settings.requirePw': 'Wymagaj hasła', 'settings.requirePwText': 'Wyłącz, aby zapisywać nowe profile bez hasła i przełączać je jednym kliknięciem.',
    'settings.launch': 'Uruchom Epic po przełączeniu', 'settings.launchText': 'Uruchamia launcher z nowym kontem.',
    'settings.path': 'Launcher', 'settings.notFound': 'Nie znaleziono launchera', 'settings.browse': 'Przeglądaj…', 'settings.auto': 'Wykryj automatycznie',
    'settings.language': 'Język', 'settings.langAuto': 'Auto',
    'settings.data': 'Otwórz folder z danymi', 'settings.about': 'Wersja {v}. Nieoficjalny projekt społeczności, niezwiązany z Epic Games, Inc.',
    'settings.keys': 'Skróty: Ctrl+F szukaj, Ctrl+N zapisz konto, Ctrl+, ustawienia, strzałki przemieszczają między kontami.',

    'rel.now': 'przed chwilą',
  },
};

/* Messages that come from the Rust core (kept verbatim there). The keys are the
   exact English texts; anything unknown is shown as it is. */
const BACKEND = {
  pl: {
    "Another operation is in progress.": 'Trwa inna operacja.',
    "Epic Games Launcher not found. Set its path in Settings.": 'Nie znaleziono Epic Games Launcher. Ustaw jego ścieżkę w Ustawieniach.',
    "Enter a profile name.": 'Wpisz nazwę profilu.',
    "Password must be at least 4 characters.": 'Hasło musi mieć co najmniej 4 znaki.',
    "A password is required (see Settings).": 'Hasło jest wymagane (zobacz Ustawienia).',
    "No Epic Games token found. Sign in to the Launcher first (with \"Remember me\" enabled).": 'Nie znaleziono tokenu Epic Games. Najpierw zaloguj się w launcherze (z włączonym „Zapamiętaj mnie”).',
    "Profile does not exist.": 'Taki profil nie istnieje.',
    "This profile already has a password.": 'Ten profil ma już hasło.',
    "This profile has no password.": 'Ten profil nie ma hasła.',
    "Enter a name.": 'Wpisz nazwę.',
    "A profile with this name already exists.": 'Profil o tej nazwie już istnieje.',
    "Invalid image.": 'Nieprawidłowy obraz.',
    "Invalid color.": 'Nieprawidłowy kolor.',
    "Image is too large (max 15 MB).": 'Obraz jest za duży (maks. 15 MB).',
    "Unsupported image type.": 'Nieobsługiwany typ obrazu.',
    "Epic session folder is too large to snapshot.": 'Folder sesji Epic jest zbyt duży, aby go zapisać.',
    "Wrong password.": 'Nieprawidłowe hasło.',
    "Windows DPAPI encryption failed.": 'Szyfrowanie Windows DPAPI nie powiodło się.',
    "Cannot decrypt this profile (saved by a different Windows user or PC?).": 'Nie można odszyfrować tego profilu (zapisany przez innego użytkownika Windows lub na innym komputerze?).',
    "Could not write the credential to Windows Credential Manager.": 'Nie udało się zapisać poświadczeń w Menedżerze poświadczeń Windows.',
    "Corrupted profile.": 'Uszkodzony profil.',
    "This profile has no session snapshot - log in to that account, then re-save it.": 'Ten profil nie ma zapisanej sesji. Zaloguj się na to konto i zapisz je ponownie.',
  },
};
const BACKEND_PREFIX = {
  pl: [
    ['Could not start the Epic Games Launcher: ', 'Nie udało się uruchomić Epic Games Launcher: '],
    ['Unexpected error: ', 'Nieoczekiwany błąd: '],
  ],
};

const I18N = (() => {
  let lang = 'en';
  const detect = () => ((navigator.language || 'en').toLowerCase().startsWith('pl') ? 'pl' : 'en');
  return {
    get lang() { return lang; },
    /** pref: 'auto' | 'en' | 'pl' */
    set(pref) {
      lang = pref === 'en' || pref === 'pl' ? pref : detect();
      document.documentElement.lang = lang;
    },
    t(key, vars) {
      let s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
      return s;
    },
    /** Translate a message coming from the Rust core. */
    backend(msg) {
      if (typeof msg !== 'string' || lang === 'en') return msg;
      const exact = BACKEND[lang] && BACKEND[lang][msg];
      if (exact) return exact;
      for (const [from, to] of BACKEND_PREFIX[lang] || []) if (msg.startsWith(from)) return to + msg.slice(from.length);
      const reset = msg.match(/^Could not reset: (.+) \(file in use\?\)\.$/);
      if (reset) return `Nie udało się wyczyścić: ${reset[1]} (plik w użyciu?).`;
      return msg;
    },
  };
})();
