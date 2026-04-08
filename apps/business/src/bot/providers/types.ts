/** Supported messaging channels. Extend this union when adding new providers. */
export type Channel = 'whatsapp';

/**
 * Channel-agnostic incoming message — the single normalized format
 * that the rest of the system (handler, queue, AI) consumes.
 * Provider implementations translate their native types into this.
 */
export interface IncomingMessage {
  id: string;
  channel: Channel;
  contactId: string;        // channel-specific contact identifier (WhatsApp JID, Telegram chatId, etc.)
  contactName: string | null; // display name provided by the channel
  fromMe: boolean;
  isGroup: boolean;
  text: string | null;
  /** Set when this message is a response to an interactive button message. */
  buttonResponseId: string | null;
  /** Set when this message is a response to an interactive list message. */
  listResponseId: string | null;
  location: {
    lat: number;
    lng: number;
    name: string | null;
    address: string | null;
  } | null;
  image: {
    buffer: Buffer;
    mimetype: string;
    caption: string | null;
  } | null;
  audio: {
    buffer: Buffer;
    mimetype: string;
    seconds: number | null;
  } | null;
}

export interface ProviderState {
  connection: 'open' | 'connecting' | 'close';
  phoneNumber: string | null;
  running: boolean;
}

/** Button definition for interactive button messages. */
export interface ButtonDef {
  id: string;
  text: string;
}

/** Row in a list section for interactive list messages. */
export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

/** Section in a list message. */
export interface ListSection {
  title: string;
  rows: ListRow[];
}

/**
 * Contract that every messaging provider must implement.
 * The handler and tenant manager interact exclusively through this interface.
 */
export interface MessagingProvider {
  readonly name: string;
  readonly channel: Channel;
  start(): Promise<void>;
  stop(): Promise<void>;
  reset(): Promise<void>;
  getState(): ProviderState;
  sendText(contactId: string, text: string): Promise<void>;
  sendImage(contactId: string, imagePath: string, caption?: string): Promise<void>;
  /** Send an interactive button message. Falls back to numbered text if unsupported. */
  sendButtons(contactId: string, body: string, buttons: ButtonDef[], footer?: string): Promise<void>;
  /** Send an interactive list message. Falls back to numbered text if unsupported. */
  sendList(contactId: string, body: string, buttonText: string, sections: ListSection[], footer?: string): Promise<void>;
}
