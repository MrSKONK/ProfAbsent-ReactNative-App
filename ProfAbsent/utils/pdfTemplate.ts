
export interface PdfData {
  nom: string;
  prenom: string;
  grade: string;
  typeAbsence: 'autorisation' | 'regularisation' | 'signalement';
  // Pour une absence d'une journée ou moins
  isPonctuel: boolean;
  dateDebut: string;
  heureDebut?: string;
  heureFin?: string;
  // Pour une absence de plusieurs jours
  dateFin?: string;
  
  dateReprise: string;
  motif: string;
  piecesJointes: string;
  remplacement: string; // Détails de la proposition de remplacement
  dateDemande: string; // Date de la signature
  logoRfBase64?: string;
  logoLyceeBase64?: string;
}

export const generatePdfHtml = (data: PdfData) => {
  const renderVolet = (titre: string) => `
    <div class="volet">
      <div class="header">
        <div class="logos">
          <div class="logo-rf">
            ${data.logoRfBase64 ? `<img src="${data.logoRfBase64}" alt="République Française" style="height: 50px; max-width: 90px; object-fit: contain;"/>` : ''}
          </div>
          <div class="logo-lycee">
            ${data.logoLyceeBase64 ? `<img src="${data.logoLyceeBase64}" alt="Lycée Baimbridge" style="height: 50px; max-width: 90px; object-fit: contain;"/>` : ''}
          </div>
        </div>
        <div class="titre-section">
          <h3>Enseignement et Education</h3>
          <h4>${titre}</h4>
        </div>
      </div>

      <div class="checkboxes">
        <div class="checkbox-row">
          <div class="box">${data.typeAbsence === 'autorisation' ? 'X' : ''}</div> <span>Demande d'autorisation d'absence</span>
        </div>
        <div class="checkbox-row">
          <div class="box">${data.typeAbsence === 'regularisation' ? 'X' : ''}</div> <span>Régularisation d'absence</span>
        </div>
        <div class="checkbox-row">
          <div class="box">${data.typeAbsence === 'signalement' ? 'X' : ''}</div> <span>Signalement d'absence</span>
        </div>
      </div>

      <div class="field-row">
        <span>Nom Prénom :</span> <span class="field-value">${data.nom} ${data.prenom}</span>
      </div>
      <div class="field-row">
        <span>Grade :</span> <span class="field-value">${data.grade}</span>
      </div>

      <div class="section-box">
        <div class="section-title">Absence</div>
        <div class="field-row">
          <span>- Le</span> <span class="field-value dotted" style="width: 80px;">${data.isPonctuel ? data.dateDebut : ''}</span>
          <span>de</span> <span class="field-value dotted" style="width: 40px;">${data.isPonctuel ? (data.heureDebut || '') : ''}</span>
          <span>h</span> <span class="field-value dotted" style="width: 40px;"></span>
          <span>à</span> <span class="field-value dotted" style="width: 40px;">${data.isPonctuel ? (data.heureFin || '') : ''}</span>
          <span>h</span> <span class="field-value dotted" style="width: 40px;"></span>
        </div>
        <div class="field-row">
          <span>- Du</span> <span class="field-value dotted" style="width: 100px;">${!data.isPonctuel ? data.dateDebut : ''}</span>
          <span>au</span> <span class="field-value dotted" style="width: 100px;">${!data.isPonctuel ? (data.dateFin || '') : ''}</span>
        </div>
        <div class="field-row">
          <span>Reprise le</span> <span class="field-value dotted" style="flex: 1;">${data.dateReprise}</span>
        </div>
        <div class="field-row">
          <span>Motif :</span> <span class="field-value dotted" style="flex: 1;">${data.motif}</span>
        </div>
        <div class="field-row">
          <span>Pièces justificatives jointes :</span> <span class="field-value dotted" style="flex: 1;">${data.piecesJointes}</span>
        </div>
      </div>

      <div class="section-box">
        <div class="section-title">Proposition de remplacement</div>
        <div class="field-row" style="flex-direction: column; align-items: flex-start;">
          <div class="field-value dotted" style="width: 100%; height: 40px; margin-top: 5px;">${data.remplacement}</div>
        </div>
      </div>

      <div class="footer">
        <div class="signature-col">
          <p>Date et signature de l'intéressé(e) :</p>
          <p>Les Abymes,</p>
          <p>Le ${data.dateDemande}</p>
        </div>
        <div class="avis-col">
          <p>Avis du Proviseur</p>
          <div class="checkbox-row"><div class="box"></div> Accordée</div>
          <div class="checkbox-row"><div class="box"></div> Refusée</div>
          <div class="checkbox-row"><div class="box"></div> Réservée</div>
        </div>
        <div class="proviseur-col">
          <p>Les Abymes,</p>
          <p>Le ... / ... / 202....</p>
          <br>
          <p>Le Proviseur</p>
          <br>
          <p style="font-weight: bold;">Marius CLAUDE</p>
        </div>
      </div>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page {
          size: A4 portrait;
          margin: 0;
        }
        html, body {
          width: 210mm;
          height: 297mm;
          margin: 0;
          padding: 0;
          background: #fff;
        }
        body {
          font-family: 'Arial', sans-serif;
          box-sizing: border-box;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .pdf-container {
          width: 95%;
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 90vh;
        }
        .volet {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
          border: 1px solid #ccc;
          border-radius: 10px;
          box-shadow: 0 2px 8px #0001;
          background: #fff;
          padding: 24px 32px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .header {
          text-align: center;
          margin-bottom: 10px;
        }
        .logos {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }
        .logo-rf {
          text-align: center;
          font-weight: bold;
          font-size: 10px;
        }
        .logo-lycee {
          text-align: right;
          font-size: 10px;
          color: #003399;
        }
        .titre-section h3 {
          margin: 0;
          color: #4a86e8;
          font-size: 14px;
          text-transform: uppercase;
        }
        .titre-section h4 {
          margin: 5px 0;
          font-size: 12px;
          font-weight: bold;
        }
        .subtitle {
          font-size: 10px;
          margin: 0;
          font-style: italic;
        }
        .checkboxes {
          font-size: 11px;
          margin-bottom: 10px;
        }
        .checkbox-row {
          display: flex;
          align-items: center;
          margin-bottom: 2px;
        }
        .box {
          width: 12px;
          height: 12px;
          border: 1px solid #000;
          margin-right: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
        }
        .field-row {
          display: flex;
          align-items: baseline;
          font-size: 11px;
          margin-bottom: 5px;
          flex-wrap: wrap;
        }
        .field-value {
          font-weight: bold;
          margin-left: 5px;
          margin-right: 5px;
        }
        .dotted {
          border-bottom: 1px dotted #000;
          min-width: 20px;
        }
        .section-box {
          border: 1px solid #000;
          padding: 10px;
          position: relative;
          margin-top: 10px;
          border-radius: 5px;
        }
        .section-title {
          position: absolute;
          top: -8px;
          left: 10px;
          background: white;
          padding: 0 5px;
          font-weight: bold;
          font-size: 11px;
        }
        .footer {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          margin-top: 20px;
        }
        .signature-col, .avis-col, .proviseur-col {
          flex: 1;
        }
        .avis-col {
          margin-left: 10px;
        }
        .proviseur-col {
          text-align: right;
        }
      </style>
    </head>
    <body>
      <div class="pdf-container">
        ${renderVolet('Récapitulatif d\'absence')}
      </div>
    </body>
    </html>
  `;
};
