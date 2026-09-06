import { Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  // Dialogue purement informatif : un seul bouton, pas de choix à faire.
  hideCancel?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      @if (data.danger) {
        <mat-icon class="warn-icon">warning</mat-icon>
      }
      {{ data.title }}
    </h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (!data.hideCancel) {
        <button mat-button (click)="ref.close(false)">
          {{ data.cancelLabel || 'Annuler' }}
        </button>
      }
      <button
        mat-flat-button
        [color]="data.danger ? 'warn' : 'primary'"
        (click)="ref.close(true)"
      >
        {{ data.confirmLabel || 'Confirmer' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    h2 { display: flex; align-items: center; gap: 8px; }
    .warn-icon { color: #f57c00; }
    /* Les messages détaillés (listes de tournois bloquants) contiennent des
       retours ligne : sans ceci ils s'affichent en un seul paragraphe. */
    mat-dialog-content { white-space: pre-line; }
  `,
})
export class ConfirmDialog {
  data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  ref = inject<MatDialogRef<ConfirmDialog>>(MatDialogRef);
}
