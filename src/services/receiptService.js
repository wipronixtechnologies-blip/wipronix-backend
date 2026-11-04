const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const fs = require('fs');

const path = require('path');



/**

 * Format a Date object or ISO string to 'DD MMM YYYY' (e.g. 30 Oct 2026)

 */

function formatDate(dateValue) {

  if (!dateValue) return '';

  try {

    const d = new Date(dateValue);

    if (isNaN(d.getTime())) return String(dateValue);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const day = String(d.getDate()).padStart(2, '0');

    const month = months[d.getMonth()];

    const year = d.getFullYear();

    return `${day} ${month} ${year}`;

  } catch (e) {

    return String(dateValue);

  }

}



/**

 * Locate assets safely across directory structures

 */

function getAssetPath(filename) {

  const candidates = [

    path.join(__dirname, '..', '..', 'assets', filename),

    path.join(__dirname, '..', 'assets', filename),

    path.join(process.cwd(), 'assets', filename),

    path.join(process.cwd(), 'wipronix-backend', 'assets', filename)

  ];



  for (const c of candidates) {

    if (fs.existsSync(c)) return c;

  }

  return candidates[0];

}



/**

 * Generates an official, un-editable PDF Registration Receipt

 * matching the authentic Wipronix template and authorized signature.

 */

async function generateReceiptPdf({

  registrationNo = '',

  date = '',

  studentName = '',

  fatherName = '',

  contactNo = '',

  email = '',

  address = '',

  technology = '',

  duration = '6 Months',

  totalFee = 0,

  discountAmount = 0,

  discountType = '',

  installmentNumber = 1,

  paidAmount = 0,

  dueAmount = 0,

  paymentMode = 'UPI',

  nextDueDate = '',

  mode = 'Remote-QR',

  isOnline = true

} = {}) {

  const templatePath = getAssetPath('receipt_template.png');
  const signaturePath = getAssetPath('receipt_signature.png');
  const stampPath = getAssetPath('receipt_stamp.png');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Receipt template image not found at: ${templatePath}`);
  }
  const templateBytes = fs.readFileSync(templatePath);

  const pdfDoc = await PDFDocument.create();

  // Standard A4 Landscape in PDF points (72 pt/inch)

  const pageWidth = 841.89;

  const pageHeight = 595.28;

  const page = pdfDoc.addPage([pageWidth, pageHeight]);



  // Scale factors from 992x701 original template image to 841.89x595.28 PDF points

  const scaleX = pageWidth / 992;

  const scaleY = pageHeight / 701;



  // Draw background template image

  const templateImage = await pdfDoc.embedPng(templateBytes);

  page.drawImage(templateImage, {

    x: 0,

    y: 0,

    width: pageWidth,

    height: pageHeight

  });



  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);



  // Helper: Sanitize text for standard WinAnsi Helvetica encoding in pdf-lib

  const cleanWinAnsi = (str) => {

    if (str === null || str === undefined) return '';

    return String(str)

      .replace(/₹/g, 'Rs. ')

      .replace(/[–—]/g, '-')

      .replace(/[‘’]/g, "'")

      .replace(/[“”]/g, '"')

      .replace(/•/g, '*')

      .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')

      .trim();

  };



  // Helper: map (pxX, pxY) from 992x701 template to PDF coordinates.

  // pxY is the TEXT BASELINE in template pixels (placed ~4px above the dotted guide line).

  // maxWidthPx shrinks the font so text never overruns the dotted line.

  const drawAtPx = (text, pxX, pxY, options = {}) => {

    if (!text && text !== 0) return;

    const sanitizedText = cleanWinAnsi(text);

    if (!sanitizedText && sanitizedText !== '0') return;



    const { isBold = true, size = 11, color = rgb(0.12, 0.12, 0.15), maxWidthPx } = options;

    const font = isBold ? helveticaBold : helveticaFont;

    let fontSize = size;

    try {

      if (maxWidthPx) {

        const maxPt = maxWidthPx * scaleX;

        while (fontSize > 7 && font.widthOfTextAtSize(sanitizedText, fontSize) > maxPt) fontSize -= 0.5;

      }

      page.drawText(sanitizedText, {

        x: pxX * scaleX,

        y: pageHeight - (pxY * scaleY),

        size: fontSize,

        font,

        color

      });

    } catch (e) {

      console.warn('drawAtPx warning for text:', sanitizedText, e.message);

    }

  };



  // Split long text into 2 lines that fit the dotted width

  const splitTwoLines = (text, font, size, maxWidthPx) => {

    const sanitized = cleanWinAnsi(text);

    const maxPt = maxWidthPx * scaleX;

    const words = sanitized.split(/\s+/).filter(Boolean);

    let line1 = '';

    let i = 0;

    for (; i < words.length; i++) {

      const next = line1 ? `${line1} ${words[i]}` : words[i];

      try {

        if (font.widthOfTextAtSize(next, size) > maxPt) break;

      } catch (e) {

        break;

      }

      line1 = next;

    }

    return [line1 || sanitized, words.slice(i).join(' ')];

  };



  const formattedDate = formatDate(date) || formatDate(new Date());

  const formattedNextDue = nextDueDate ? (formatDate(nextDueDate) || nextDueDate) : 'N/A';

  const LEFT_X = 188;

  const RIGHT_X = 652;

  const LEFT_MAX = 290;

  const RIGHT_MAX = 285;



  // Header row

  drawAtPx(registrationNo, 200, 209, { isBold: true, size: 10.5, color: rgb(0.1, 0.35, 0.65), maxWidthPx: 125 });

  drawAtPx(formattedDate, 378, 209, { isBold: true, size: 10, maxWidthPx: 95 });



  // Left Column Details

  drawAtPx(studentName, LEFT_X, 258, { isBold: true, size: 12, color: rgb(0.08, 0.08, 0.12), maxWidthPx: LEFT_MAX });

  drawAtPx(fatherName || 'Not Provided', LEFT_X, 297, { isBold: true, size: 11, maxWidthPx: LEFT_MAX });

  drawAtPx(contactNo, LEFT_X, 335, { isBold: true, size: 11, maxWidthPx: LEFT_MAX });

  drawAtPx(email, LEFT_X, 375, { isBold: false, size: 10.5, maxWidthPx: LEFT_MAX });

  const [addr1, addr2] = splitTwoLines(address || 'Not Provided', helveticaFont, 10.5, LEFT_MAX);

  drawAtPx(addr1, LEFT_X, 414, { isBold: false, size: 10.5, maxWidthPx: LEFT_MAX });

  if (addr2) drawAtPx(addr2, LEFT_X, 453, { isBold: false, size: 10.5, maxWidthPx: LEFT_MAX });



  // Right Column Details

  const techLabel = Number(installmentNumber) > 1 ? `${technology} [Inst. #${installmentNumber}]` : technology;

  drawAtPx(techLabel, RIGHT_X, 217, { isBold: true, size: 11.5, color: rgb(0.45, 0.1, 0.45), maxWidthPx: RIGHT_MAX });

  drawAtPx(duration || '6 Months', RIGHT_X, 257, { isBold: true, size: 11, maxWidthPx: RIGHT_MAX });

  if (Number(discountAmount) > 0) {

    const net = Math.max(0, Number(totalFee || 0) - Number(discountAmount));

    const discLabel = discountType ? ` (${discountType} -Rs. ${Number(discountAmount).toLocaleString('en-IN')}) [Net: Rs. ${net.toLocaleString('en-IN')}]` : ` (-Rs. ${Number(discountAmount).toLocaleString('en-IN')}) [Net: Rs. ${net.toLocaleString('en-IN')}]`;

    drawAtPx(`Rs. ${Number(totalFee || 0).toLocaleString('en-IN')}${discLabel}`, RIGHT_X, 295, { isBold: true, size: 8.5, maxWidthPx: RIGHT_MAX });

  } else {

    drawAtPx(`Rs. ${Number(totalFee || 0).toLocaleString('en-IN')}`, RIGHT_X, 295, { isBold: true, size: 11 });

  }

  drawAtPx(`Rs. ${Number(paidAmount || 0).toLocaleString('en-IN')}`, RIGHT_X, 334, { isBold: true, size: 11.5, color: rgb(0.05, 0.55, 0.25) });

  drawAtPx(`Rs. ${Number(dueAmount || 0).toLocaleString('en-IN')}`, RIGHT_X, 373, { isBold: true, size: 11.5, color: rgb(0.8, 0.1, 0.1) });



  // Payment Mode tick — checkbox squares measured at y 402-418, centers x: Cash 668, UPI 754, Bank 827

  const paymentMethod = (paymentMode || 'UPI').toUpperCase();

  let boxCenterX = 754;

  if (paymentMethod.includes('CASH')) boxCenterX = 668;

  else if (paymentMethod.includes('BANK')) boxCenterX = 827;

  const tickSize = 11;

  const tickWidthPx = helveticaBold.widthOfTextAtSize('X', tickSize) / scaleX;

  drawAtPx('X', boxCenterX - tickWidthPx / 2, 413, { isBold: true, size: tickSize, color: rgb(0.05, 0.55, 0.25) });



  // Next Due Date

  drawAtPx(formattedNextDue, RIGHT_X, 451, { isBold: false, size: 10.5 });



  // Official Stamp & Authorized Signature Block (Included on each receipt)

  // 1. Column 1: Authorized Signature Block (Left side)
  const sigCenterX = 144.5;
  if (fs.existsSync(signaturePath)) {
    try {
      const signatureBytes = fs.readFileSync(signaturePath);
      const signatureImage = await pdfDoc.embedPng(signatureBytes);
      const sigMaxWPx = 155;
      const sigMaxHPx = 60;
      const ratio = signatureImage.width / signatureImage.height;
      let sigWPx = sigMaxWPx;
      let sigHPx = sigWPx / ratio;
      if (sigHPx > sigMaxHPx) {
        sigHPx = sigMaxHPx;
        sigWPx = sigHPx * ratio;
      }
      const sigBottomPx = 642;
      page.drawImage(signatureImage, {
        x: (sigCenterX - sigWPx / 2) * scaleX,
        y: pageHeight - (sigBottomPx * scaleY),
        width: sigWPx * scaleX,
        height: sigHPx * scaleY
      });
    } catch (sigErr) {
      console.warn('Could not draw signature image:', sigErr.message);
    }
  }

  // 2. Column 3: Stamp / Seal Block (Right side / Official Stamp side)
  const stampCenterX = 846.5;
  if (fs.existsSync(stampPath)) {
    try {
      const stampBytes = fs.readFileSync(stampPath);
      const stampImage = await pdfDoc.embedPng(stampBytes);
      const stampMaxWPx = 165;
      const stampMaxHPx = 50;
      const stampRatio = stampImage.width / stampImage.height;
      let stampWPx = stampMaxWPx;
      let stampHPx = stampWPx / stampRatio;
      if (stampHPx > stampMaxHPx) {
        stampHPx = stampMaxHPx;
        stampWPx = stampHPx * stampRatio;
      }
      const stampBottomPx = 642;
      page.drawImage(stampImage, {
        x: (stampCenterX - stampWPx / 2) * scaleX,
        y: pageHeight - (stampBottomPx * scaleY),
        width: stampWPx * scaleX,
        height: stampHPx * scaleY,
        opacity: 0.95
      });
    } catch (stErr) {
      console.warn('Could not draw stamp image:', stErr.message);
    }
  }

  const pdfBytes = await pdfDoc.save();

  return Buffer.from(pdfBytes);

}



/**

 * Save receipt PDF buffer to local storage in data/receipts/

 */

function saveReceiptPdfToDisk(registrationNo, pdfBuffer) {

  const receiptsDir = path.join(__dirname, '..', '..', 'data', 'receipts');

  if (!fs.existsSync(receiptsDir)) {

    fs.mkdirSync(receiptsDir, { recursive: true });

  }

  const cleanRegNo = registrationNo.replace(/[^a-zA-Z0-9_-]/g, '_');

  const filePath = path.join(receiptsDir, `${cleanRegNo}.pdf`);

  fs.writeFileSync(filePath, pdfBuffer);

  return filePath;

}



/**

 * Get disk path for saved receipt if it exists

 */

function getReceiptPdfPath(registrationNo) {

  if (!registrationNo) return null;

  const cleanRegNo = registrationNo.replace(/[^a-zA-Z0-9_-]/g, '_');

  const filePath = path.join(__dirname, '..', '..', 'data', 'receipts', `${cleanRegNo}.pdf`);

  return fs.existsSync(filePath) ? filePath : null;

}



/**

 * High-level helper: Generate and store PDF receipt for a registration slip and student

 */

async function generateAndSaveReceipt(slip, student = {}) {

  const regNo = slip.registrationNo || `WPX-${Date.now()}`;

  const pdfBuffer = await generateReceiptPdf({

    registrationNo: regNo,

    date: slip.verifiedAt || slip.date || new Date(),

    studentName: student.fullName || slip.studentName || 'Student',

    fatherName: slip.fatherName || student.fatherName || '',

    contactNo: student.phoneNumber || slip.contactNo || '',

    email: student.email || slip.email || '',

    address: slip.address || student.address || student.city || '',

    technology: slip.registeredTechnology || slip.technology || student.registeredTechnology || student.admissionTechnology || 'Training Track',

    duration: slip.duration || student.trainingDuration || '6 Months',

    totalFee: slip.totalFee || student.totalFee || 25000,

    discountAmount: slip.discountAmount || student.discountAmount || 0,

    discountType: slip.discountType || student.discountType || '',

    installmentNumber: slip.installmentNumber || 1,

    paidAmount: slip.paidAmount || slip.registrationFee || 0,

    dueAmount: slip.dueAmount !== undefined ? slip.dueAmount : (student.netRemainingFee || 0),

    paymentMode: slip.paymentMode || 'UPI',

    mode: slip.mode || (slip.paymentMode === 'Cash' ? 'In-Office' : 'Remote-QR'),

    isOnline: slip.mode === 'Remote-QR' || (slip.paymentMode && slip.paymentMode !== 'Cash'),

    nextDueDate: slip.nextDueDate || student.nextDueDate || ''

  });



  const filePath = saveReceiptPdfToDisk(regNo, pdfBuffer);

  return {

    filePath,

    pdfBuffer,

    registrationNo: regNo

  };

}



module.exports = {

  generateReceiptPdf,

  saveReceiptPdfToDisk,

  getReceiptPdfPath,

  generateAndSaveReceipt,

  formatDate

};

