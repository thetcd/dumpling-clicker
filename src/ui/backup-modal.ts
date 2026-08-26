// The backup-code hand-over. Split out of the settings sheet so both callers
// that are not the settings sheet — the migration nag and the retired-site
// screen (ui/farewell.ts) — can reach it without importing the audio stack.
//
// Its own function because the failure path re-enters it: modal buttons close
// the modal before onClick runs, so if the clipboard write is blocked the code
// would vanish with the modal — reopening keeps it on screen for a manual copy.
// The code is base64 (plus the DC1: prefix), so it is innerHTML-safe by
// construction — tests/backup.test.ts pins the alphabet.
import { STR } from '../i18n/strings.he';
import { markCodeSaved } from '../migration';
import { showModal } from './modal';
import { toast } from './toast';

export function openBackupModal(code: string): void {
  showModal({
    title: STR.backup,
    bodyHTML: `<p>${STR.backupBody}</p>
      <textarea class="backup-code" readonly dir="ltr">${code}</textarea>`,
    buttons: [
      {
        label: STR.backupCopy,
        primary: true,
        onClick: () => {
          navigator.clipboard.writeText(code).then(
            () => {
              // The ONLY point at which a code is known to have left the
              // device, so it is also the only honest place to stop nagging
              // about the move. Opening this modal must never count.
              markCodeSaved();
              toast(STR.copied);
            },
            () => {
              openBackupModal(code);
              toast(STR.backupCopyFailed);
            },
          );
        },
      },
      { label: STR.close },
    ],
  });
}
