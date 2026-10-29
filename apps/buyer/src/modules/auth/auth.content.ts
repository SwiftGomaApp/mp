export const LOGIN_CONTENT = {
  title: "Connectez-vous à votre compte",
  subtitle: "Entrez votre e-mail, nous vous envoyons un code pour vous connecter.",
  emailPlaceholder: "Adresse e-mail",
  usePassword: "Se connecter avec un mot de passe",
  usePhone: "Numéro de téléphone",
  useEmail: "Adresse e-mail",
  phonePlaceholder: "8XX XXX XXX",
  continue: "Continuer",
  or: "ou",
  google: "Continuer avec Google",
  passkey: "Continuer avec une clé d'accès",
  apple: "Continuer avec Apple",
  noAccount: "Pas encore de compte ?",
  signUp: "S'inscrire",
  createAccount: "Créer un compte",
} as const;

export const PASSWORD_CONTENT = {
  title: "Connexion par mot de passe",
  description: "Entrez votre e-mail et votre mot de passe.",
  emailPlaceholder: "Adresse e-mail",
  passwordPlaceholder: "Mot de passe",
  showPassword: "Afficher le mot de passe",
  hidePassword: "Masquer le mot de passe",
  forgotPassword: "Mot de passe oublié ?",
  submit: "Se connecter",
  close: "Fermer",
} as const;

export const FORGOT_CONTENT = {
  title: "Mot de passe oublié",
  description: "Entrez votre e-mail, nous vous envoyons un code pour le réinitialiser.",
  emailPlaceholder: "Adresse e-mail",
  send: "Envoyer le code",
  back: "Retour à la connexion",
} as const;

export const CODE_DIALOG_CONTENT = {
  title: "Code de vérification",
  placeholder: "000000",
  submit: "Vérifier",
  email: (target: string) => `Entrez le code à 6 chiffres envoyé à ${target}.`,
  phone: (target: string) => `Entrez le code à 6 chiffres envoyé par SMS au ${target}.`,
  twoStepTitle: "Vérification en deux étapes",
  twoStep: "Entrez le code à 6 chiffres de votre application d'authentification.",
} as const;

export const REGISTER_CONTENT = {
  title: "Créez votre compte",
  subtitle: "Quelques informations pour commencer.",
  namePlaceholder: "Nom complet",
  ageConfirm: "J'ai au moins 18 ans",
  submit: "Continuer",
  haveAccount: "Vous avez déjà un compte ?",
  signIn: "Se connecter",
} as const;
