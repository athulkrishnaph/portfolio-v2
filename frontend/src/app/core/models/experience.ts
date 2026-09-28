import { IsoDate } from './api';

export interface Experience {
  id: number;
  company: string;
  position: string;
  location: string;
  description: string;
  startDate: IsoDate;
  /** null while isCurrent is true. */
  endDate: IsoDate | null;
  isCurrent: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type ExperienceInput = Omit<Experience, 'id' | 'createdAt' | 'updatedAt'>;
