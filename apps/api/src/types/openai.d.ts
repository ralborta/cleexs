declare module 'openai' {
  export default class OpenAI {
    constructor(options: { apiKey: string });
    chat: any;
  }
}
