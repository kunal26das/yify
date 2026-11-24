# Catalog artwork

## Purpose

Show movie artwork on every platform from the catalog's own image host, including artwork saved before the image proxy was retired.

## ADDED Requirements

### Requirement: Catalog artwork loads directly from the catalog image host

Movie posters, backdrops, thumbnails, screenshots and cast photos SHALL reference the catalog's own image URLs over HTTPS, without a third-party image proxy. Insecure catalog URLs SHALL be upgraded to HTTPS, and unusable values SHALL be omitted so the existing title fallback remains visible.

#### Scenario: Browsing and details

- **WHEN** the catalog returns cover, backdrop, screenshot or cast image URLs
- **THEN** web and native clients load that artwork from the catalog's HTTPS image host and no image URL targets an image proxy

#### Scenario: Poster size

- **WHEN** a poster is drawn up to 230 physical pixels wide
- **THEN** the medium cover is loaded; a larger poster loads the large cover with the medium cover as its placeholder

#### Scenario: Missing or malformed artwork

- **WHEN** a catalog image value is empty, unparsable or uses a scheme other than HTTP or HTTPS
- **THEN** that image is omitted, the remaining artwork and the list still load, and a poster without artwork shows its title

### Requirement: Public catalog responses carry only direct artwork

The public catalog API SHALL forward only HTTPS image URLs on public hosts with an image file extension and no query, credentials, port or fragment, in addition to its existing download, magnet and hash checks.

#### Scenario: Proxied image URL

- **WHEN** a projected movie contains an image URL with a query string, including an image-proxy URL
- **THEN** that URL is omitted from the response

### Requirement: Saved titles recover artwork stored through the retired proxy

Watchlist, history and journal entries whose artwork points at the retired wsrv.nl proxy SHALL display the original image URL that the proxy URL wrapped. Unrelated and malformed stored values SHALL be left unchanged.

#### Scenario: Saved watchlist title

- **WHEN** a stored or synced watchlist title has proxied poster, backdrop or thumbnail URLs
- **THEN** the watchlist shows the direct images, stores the repaired URLs locally and does not upload because of the repair

#### Scenario: History and journal entries

- **WHEN** a history or journal entry has a proxied artwork URL
- **THEN** the entry displays the direct image while its stored and synced record stays unchanged
