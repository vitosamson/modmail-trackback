export type Headers = {
  Authorization: string;
  'User-Agent': string;
};

export type ModmailList = Array<{
  id: string;
  isNew: bool;
  body: string;
}>;
