import { Component } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { environment } from '../../../environments/environment';

// Notice d'utilisation : le déroulé d'une soirée, dans l'ordre où on s'en
// sert, plus les réponses aux questions déjà posées. Imprimable pour être
// posée à côté du PC pendant le tournoi.
@Component({
  selector: 'app-help-page',
  imports: [MatCardModule, MatIconModule, MatButtonModule],
  template: `
    <div class="toolbar no-print">
      <h1>Notice d'utilisation</h1>
      <span class="spacer"></span>
      <button mat-stroked-button (click)="print()">
        <mat-icon>print</mat-icon> Imprimer
      </button>
    </div>

    <mat-card class="notice">
      <mat-card-content>
        <p class="lead">
          PABB90 gère les soirées de tarot du club : un <strong>Challenge</strong>
          couvre un trimestre, il contient un <strong>Tournoi</strong> par
          soirée, et chaque tournoi se joue en plusieurs <strong>manches</strong>
          (4 au club). Version {{ version }}.
        </p>

        <h2>Une fois pour toutes</h2>
        <ol>
          <li>
            <strong>Créer le club</strong> — Administration, onglet Clubs,
            « Ajouter un club ». Le logo se charge depuis la fiche du club, il
            apparaît en bas du bandeau et sur les classements imprimés.
          </li>
          <li>
            <strong>Choisir le club par défaut</strong> — Administration, onglet
            Paramètres. Son nom s'affiche en haut du bandeau et il est
            présélectionné à la création d'un challenge. C'est aussi là que se
            règle le nombre de manches par défaut.
          </li>
          <li>
            <strong>Importer les joueurs</strong> — Administration, onglet
            Joueurs, « Importer une liste ». Un fichier CSV avec la licence et
            le nom suffit. La case « adhérent » se coche dans la fiche du
            joueur.
          </li>
          <li>
            <strong>Changer le mot de passe admin</strong> — Administration,
            onglet Utilisateurs. Le mot de passe livré est
            <code>admin / admin123</code>.
          </li>
        </ol>

        <h2>Au début du trimestre</h2>
        <p>
          Écran Challenges, bouton « Nouveau Challenge » : un code, un nom, le
          club, une date. C'est lui qui portera le classement trimestriel.
        </p>

        <h2>Le soir d'un tournoi</h2>
        <ol>
          <li>
            <strong>Créer le tournoi</strong> — ouvrir le challenge, « Ajouter
            un tournoi ». Le nom proposé est la date du jour. Vérifier le
            nombre de manches. Le tournoi s'ouvre sur sa page, qui déroule les
            étapes de la soirée.
          </li>
          <li>
            <strong>Pointer les présents</strong> — étape 1, bouton
            « Joueurs ». Cocher les joueurs présents ; le crayon à côté d'un nom
            corrige une faute de frappe, et « Nouveau joueur » ajoute un absent
            de la liste. Le pointage est conservé si vous quittez la page.
            Pour chaque joueur, on peut imposer une orientation (Nord, Sud,
            Est, Ouest ou « non Nord ») ; par défaut elle est tirée au sort.
          </li>
          <li>
            <strong>Tirer au sort</strong> — le bouton forme les tables de 4 et,
            s'il le faut, des tables de 3 où le Nord est tenu par un joueur
            virtuel « Relais », fixe à sa table toute la soirée et qui marque
            des points comme les autres. Toutes les manches prévues sont
            générées d'un coup.
          </li>
          <li>
            <strong>Imprimer</strong> — étape 2 : « Placement » donne le
            tableau des positions de départ sur une page ; « Feuilles de
            marque » donne une feuille par table et par manche, à distribuer.
          </li>
          <li>
            <strong>Lancer la manche</strong> — la minuterie du bandeau (50
            minutes par défaut) sonne la fin. Le premier démarrage doit se
            faire par un clic, sinon le navigateur bloque le son.
          </li>
          <li>
            <strong>Saisir les résultats</strong> — étape 3, « Tables &amp;
            saisie ». Pour chaque table, entrer le résultat de chaque joueur :
            <em>Entrée</em> valide la case et passe à la suivante, et le dernier
            score se calcule tout seul pour que la somme fasse zéro. Les
            raccourcis en haut de l'écran passent d'une table à l'autre dans
            l'ordre où les feuilles arrivent. Une table validée reste
            modifiable.
          </li>
          <li>
            <strong>Classement de la manche</strong> — bouton à côté de chaque
            manche, imprimable ou exportable en PDF. Puis manche suivante.
          </li>
          <li>
            <strong>Classement général</strong> — étape 4, après la dernière
            manche. Il alimente automatiquement le classement du Challenge.
          </li>
        </ol>

        <h2>Le classement du Challenge</h2>
        <p>
          Il est en bas de la page du challenge, avec une colonne par tournoi.
          Deux modes : <strong>Par place</strong> (le premier d'un tournoi
          marque autant de points qu'il y a de joueurs, le dernier 1 point) ou
          <strong>Par points</strong> (les scores bruts cumulés). Un tournoi
          joué sur l'Excel de la fédération s'ajoute avec « Importer un tournoi
          (CSV) », et la corbeille sur une carte retire un tournoi du
          challenge.
        </p>

        <h2>Questions courantes</h2>
        <dl>
          <dt>Imprimer en PDF ?</dt>
          <dd>
            Le bouton PDF ouvre la fenêtre d'impression : choisir
            « Enregistrer au format PDF » comme imprimante.
          </dd>
          <dt>Une erreur dans la mise en place ?</dt>
          <dd>
            « Régénérer la mise en place » sur la manche refait le tirage.
            À ne pas faire après avoir saisi des scores, ils seraient perdus.
          </dd>
          <dt>Supprimer un tournoi ou un challenge d'essai ?</dt>
          <dd>
            La corbeille sur la carte du tournoi, ou celle de la ligne du
            challenge dans la liste. Les joueurs, eux, sont toujours conservés.
          </dd>
          <dt>Un joueur ne peut pas être supprimé ?</dt>
          <dd>
            C'est qu'il est engagé dans un tournoi. Le message indique lequel et
            propose de forcer si aucun résultat n'est en jeu.
          </dd>
          <dt>Les données sont-elles perdues à la mise à jour ?</dt>
          <dd>
            Non. L'installeur s'installe par-dessus la version précédente et ne
            touche pas à la base.
          </dd>
        </dl>

        <h2>Un problème, une idée ?</h2>
        <p class="no-print">
          Les remarques se déposent sur la page des tickets du projet, elles y
          sont suivies une par une.
        </p>
        <p class="no-print">
          <a mat-flat-button color="primary" [href]="issuesUrl" target="_blank" rel="noopener">
            <mat-icon>bug_report</mat-icon> Signaler un problème
          </a>
        </p>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .toolbar { display: flex; align-items: center; margin-bottom: 16px; }
    .toolbar h1 { margin: 0; }
    .spacer { flex: 1 1 auto; }
    .notice { max-width: 900px; }
    .notice mat-card-content { padding-top: 16px; }
    .lead { font-size: 1.05em; color: #424242; }
    h2 {
      margin: 28px 0 8px; font-size: 1.15em; color: #0d47a1;
      border-bottom: 1px solid #e0e0e0; padding-bottom: 4px;
    }
    ol { padding-left: 22px; }
    li { margin-bottom: 10px; }
    dl { margin: 0; }
    dt { font-weight: 600; margin-top: 12px; }
    dd { margin: 2px 0 0 16px; color: #424242; }
    code { background: #f5f5f5; padding: 1px 5px; border-radius: 3px; }
    @media print {
      .no-print { display: none !important; }
      .notice { box-shadow: none !important; max-width: none; }
      h2 { page-break-after: avoid; }
      li, dt, dd { page-break-inside: avoid; }
    }
  `,
})
export class HelpPage {
  version = environment.appVersion;
  issuesUrl = 'https://github.com/BastienMOUGET/FF-TAROT/issues/new';

  print(): void {
    window.print();
  }
}
