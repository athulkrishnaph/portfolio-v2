import { Injectable } from '@angular/core';

import { CrudApi } from '../api/crud-api';
import { Skill, SkillGroup, SkillInput } from '../models';

@Injectable({ providedIn: 'root' })
export class SkillsService extends CrudApi<Skill, SkillInput> {
  protected readonly path = '/api/skills';
}

/**
 * Groups skills by category, keeping the API's order (the API already sorts
 * by category, then display order).
 */
export function groupSkills(skills: Skill[]): SkillGroup[] {
  const groups = new Map<string, Skill[]>();
  for (const skill of skills) {
    const list = groups.get(skill.category) ?? [];
    list.push(skill);
    groups.set(skill.category, list);
  }
  return [...groups].map(([category, items]) => ({ category, skills: items }));
}
