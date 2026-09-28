import { IsoDate } from './api';

export interface Education {
  id: number;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  location: string;
  description: string;
  startDate: IsoDate;
  /** null while still studying. */
  endDate: IsoDate | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type EducationInput = Omit<Education, 'id' | 'createdAt' | 'updatedAt'>;
