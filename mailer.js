const nodemailer = require('nodemailer');

// Configuração do transporter com tratamento de erro melhorado
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false // Apenas para testes, remova em produção
  }
});

// Função melhorada para enviar email de recuperação
exports.sendPasswordResetEmail = async (userEmail, resetLink) => {
  const mailOptions = {
    from: `"Suporte Croesus" <${process.env.SMTP_FROM}>`,
    to: userEmail, // Vai para o email do usuário que solicitou
    subject: 'Recuperação de Senha - Croesus',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Recuperação de Senha</h2>
        <p>Olá,</p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
        <p style="margin: 20px 0;">
          <a href="${resetLink}" 
             style="background-color: #2563eb; color: white; 
                    padding: 10px 20px; text-decoration: none; 
                    border-radius: 5px; display: inline-block;">
            Redefinir Senha
          </a>
        </p>
        <p>Se você não solicitou isso, por favor ignore este email.</p>
        <p style="font-size: 12px; color: #6b7280;">
          Este link expira em 1 hora.<br>
          Caso o botão não funcione, copie e cole este link no seu navegador:<br>
          ${resetLink}
        </p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email enviado:', info.messageId);
    return true;
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    throw new Error('Falha ao enviar email de recuperação');
  }
};