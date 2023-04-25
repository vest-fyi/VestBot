export enum Intent {
  GET_FUNDAMENTAL = 'GetFundamental',
  CANCEL = 'cancel',
  HELP = 'help',
}

// used for welcome card - clicking on button will input the utterance into the chat on behalf of user
export const IntentUtterance: Record<Intent, string> = {
    [Intent.GET_FUNDAMENTAL]: 'get fundamental',
    [Intent.CANCEL]: 'cancel',
    [Intent.HELP]: 'help',
}