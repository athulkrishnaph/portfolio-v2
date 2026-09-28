import { IsoDate } from './api';

export interface Certificate {
  id: number;
  title: string;
  issuer: string;
  issueDate: IsoDate;
  credentialUrl: string;
  imageUrl: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type CertificateInput = Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>;
