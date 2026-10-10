# catalog-recovery Specification

## Purpose
Keep existing discovery content usable and recoverable across refreshes, partial catalog failures and delayed requests.

## Requirements

### Requirement: Refresh isolates outdated requests
Home refresh SHALL prevent responses and cleanup from earlier requests from replacing or interfering with the current refresh, including hero and shelf requests.

#### Scenario: Old request finishes last
- **WHEN** a user refreshes while a hero or shelf request is pending and the older response completes later
- **THEN** only the current refresh can update visible content, pagination, loading state and request tracking

### Requirement: Partial catalog failure remains recoverable
Successful content SHALL remain visible when another home section or a movie-detail refresh fails. A failed existing section SHALL offer clear feedback and retry; initial failure without usable content SHALL retain its full error/retry state.

#### Scenario: Empty hero with populated shelves
- **WHEN** the hero has no movies but a home shelf has results
- **THEN** the shelf remains browsable

#### Scenario: Failed section
- **WHEN** a shelf request fails while other content succeeds
- **THEN** the failure is visible with a retry that can recover that shelf

#### Scenario: Exhausted shelf contains only duplicates
- **WHEN** a successful shelf has no unseen titles after deduplication and cannot fetch more
- **THEN** it leaves no empty rail, while a shelf with more pages continues its existing pagination

#### Scenario: Refresh fails after a successful load
- **WHEN** home or movie details refresh fails with existing content
- **THEN** that content remains visible with an honest refresh-failure notice, which clears after successful retry
