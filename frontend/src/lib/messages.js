/**
 * Every message the app shows for validation, errors and states, in one place.
 *
 * Wording comes from the brief and the Figma frames where they have it. Strings marked "new" are not
 * in either; they are listed in the QA report so the client can review them.
 */
export const MESSAGES = {
  // Brief and Figma wording.
  loginFailed: 'Email or password is incorrect',
  emailTaken: 'Email already registered',
  passwordTooShort: 'Password needs at least 8 characters',
  nicknameInvalid: '3–20 characters, letters, digits, _',
  nicknameTaken: 'Nickname taken',
  tooYoung: 'You must be at least 16',
  dailyLimitReached: 'Daily limit reached for this action',
  leaderboardEveryoneNote: 'This week · resets Monday 00:00',
  leaderboardFollowingNote: 'This week · you and the people you follow',
  leaderboardEmpty: 'No points yet this week. Be the first to log an action!',
  notFollowingAnyone: 'You are not following anyone yet',
  guideNoResults: 'No entries match your filter',
  historyEmpty: 'Nothing logged yet.',
  searchPrompt: 'Type a nickname to find students',
  noStudentFound: 'No student found',
  resetIntro: 'Enter your email and we will send you a link.',
  resetLinkSent: 'If this email has an account, we sent a link',
  newPasswordIntro: 'Opened from the emailed link.',
  passwordSaved: 'Password saved. You can log in now.',
  newBadge: 'New badge!',
  locked: 'Locked',

  // New strings.
  emailInvalid: 'Enter a valid email address',
  passwordMissing: 'Enter your password',
  nameInvalid: '1–50 characters',
  birthDateInvalid: 'Enter a valid date as DD.MM.YYYY',
  universityInvalid: '2–60 characters',
  rateLimited: 'Too many attempts. Please wait a minute and try again.',
  network: 'Could not reach the server. Check your connection and try again.',
  generic: 'Something went wrong. Please try again.',
  signedUpWithoutSession: 'Your account was created. Please log in.',
  loadFailed: 'Could not load this page. Please try again.',
  notConfigured: 'This site is not configured yet: the Supabase address or key is missing.',
  resetLinkInvalid: 'This link is invalid or has expired. Please ask for a new one.',
  samePassword: 'Choose a password different from your old one.',
  studentNotFound: 'This student doesn’t exist or has deleted their account.',
  ownProfile: 'This is your profile.',
  noBadgesYet: 'No badges yet',
  deleteQuestion: 'Delete your account?',
  deleteExplanation: 'This removes your login, your profile, all your logs and your follows. It can’t be undone.',
}
