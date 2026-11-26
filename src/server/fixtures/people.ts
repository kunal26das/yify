import type {PersonSummary} from '@/core/domain/person';
import type {Paged} from '@/core/domain/search';
import peoplePopular from './v2/people.popular.json';

const PEOPLE = peoplePopular as unknown as Paged<PersonSummary>;

export function fixturePopularPeople(): Paged<PersonSummary> {
  return PEOPLE;
}
