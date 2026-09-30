export interface Document {
  id: string;
  title: string;
  content: string;
}

export interface Chunk {
  id: string;
  docId: string;
  title: string;
  text: string;
}

export interface SourceRef {
  docId: string;
  title: string;
}