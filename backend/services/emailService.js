const nodemailer = require('nodemailer');

let transporter = null;

const createTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('Email service: SMTP not configured. Email notifications disabled.');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    console.log('Email service: SMTP transporter created successfully.');
    return transporter;
  } catch (error) {
    console.error('Email service: Failed to create transporter:', error.message);
    return null;
  }
};

const sendEmail = async (to, subject, html) => {
  if (!transporter) {
    transporter = createTransporter();
  }
  if (!transporter) return false;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'ApprovalFlow <noreply@approvalflow.com>',
      to,
      subject,
      html
    });
    return true;
  } catch (error) {
    console.error('Email send error:', error.message);
    return false;
  }
};

const emailTemplates = {
  welcome: (name) => ({
    subject: 'Welcome to ApprovalFlow',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">Welcome to ApprovalFlow</h1>
        </div>
        <div style="padding: 30px;">
          <p style="color: #333; font-size: 16px;">Hi ${name},</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">Your account has been created successfully. You can now start uploading documents and managing your approval workflows.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/login.html" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600;">Get Started</a>
          </div>
        </div>
      </div>
    `
  }),

  documentApproved: (recipientName, docTitle, approverName, approverRole) => ({
    subject: `Document Approved: ${docTitle}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">✅ Document Approved</h1>
        </div>
        <div style="padding: 30px;">
          <p style="color: #333; font-size: 16px;">Hi ${recipientName},</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">Your document "<strong>${docTitle}</strong>" has been approved by <strong>${approverName}</strong> (${approverRole}).</p>
        </div>
      </div>
    `
  }),

  documentRejected: (recipientName, docTitle, approverName, comment) => ({
    subject: `Document Rejected: ${docTitle}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">❌ Document Rejected</h1>
        </div>
        <div style="padding: 30px;">
          <p style="color: #333; font-size: 16px;">Hi ${recipientName},</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">Your document "<strong>${docTitle}</strong>" has been rejected by <strong>${approverName}</strong>.</p>
          ${comment ? `<p style="color: #555; font-size: 14px; background: #fff3cd; padding: 12px; border-radius: 8px;"><strong>Reason:</strong> ${comment}</p>` : ''}
        </div>
      </div>
    `
  }),

  revisionRequested: (recipientName, docTitle, approverName, comment) => ({
    subject: `Revision Requested: ${docTitle}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">🔄 Revision Requested</h1>
        </div>
        <div style="padding: 30px;">
          <p style="color: #333; font-size: 16px;">Hi ${recipientName},</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">A revision has been requested on your document "<strong>${docTitle}</strong>" by <strong>${approverName}</strong>.</p>
          ${comment ? `<p style="color: #555; font-size: 14px; background: #fff3cd; padding: 12px; border-radius: 8px;"><strong>Comments:</strong> ${comment}</p>` : ''}
        </div>
      </div>
    `
  }),

  documentCompleted: (recipientName, docTitle) => ({
    subject: `Document Approved & Completed: ${docTitle}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">🎉 Document Completed</h1>
        </div>
        <div style="padding: 30px;">
          <p style="color: #333; font-size: 16px;">Hi ${recipientName},</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">Great news! Your document "<strong>${docTitle}</strong>" has been fully approved and is now marked as <strong>Completed</strong>.</p>
        </div>
      </div>
    `
  }),

  pendingApproval: (recipientName, docTitle, employeeName, department) => ({
    subject: `New Document Pending Approval: ${docTitle}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">📄 New Document for Review</h1>
        </div>
        <div style="padding: 30px;">
          <p style="color: #333; font-size: 16px;">Hi ${recipientName},</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">A new document "<strong>${docTitle}</strong>" has been submitted by <strong>${employeeName}</strong> from the <strong>${department}</strong> department and requires your review.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/approvals.html" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600;">Review Document</a>
          </div>
        </div>
      </div>
    `
  })
};

module.exports = { sendEmail, emailTemplates, createTransporter };
