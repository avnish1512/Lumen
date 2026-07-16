# Requirements Document

## Introduction

The Watch Recommender is a feature for the Lumen streaming app that helps users decide what to watch when they have no specific title in mind. From an entry-point control, the user selects one of the app's four content categories (Movie, TV Show, Anime, or Drama). The feature then surfaces a single recommended title drawn from popular or trending content in that category, showing its poster, title, and key details. The user can act on the recommendation by opening its detail page or playing it, or request a different recommendation ("shuffle again"). The feature reuses existing data sources — TMDB for Movie, TV Show, and Drama content, and AniList for Anime — and existing client helpers (`fetchTmdbHomeRails`, `searchTmdb`, `fetchAnimeByOptions`) and the shared `Movie` type. The feature operates within both the "Lumen" (Apple-style) and "Anime" (Netflix-style) skins and works on mobile-first and desktop layouts.

Optional light preference refinement (for example, genre or mood) is captured as optional scope for a later iteration.

## Glossary

- **Watch_Recommender**: The feature that presents a recommended title to the user based on a chosen content category.
- **Category**: One of the four content types the user can request a recommendation for: Movie, TV Show, Anime, or Drama.
- **Recommendation**: A single title selected by the Watch_Recommender for presentation to the user.
- **Candidate_Pool**: The set of titles from which the Watch_Recommender selects a Recommendation for a chosen Category, sourced from popular or trending content in that Category.
- **Movie_Object**: An instance of the app's shared `Movie` type, containing fields such as `title`, `poster`, `year`, `genres`, `rating`, and `synopsis`.
- **Entry_Control**: The tappable control that opens the Watch_Recommender ("I don't know what to watch").
- **Shuffle_Control**: The tappable control that requests a different Recommendation for the currently selected Category.
- **Data_Source**: The backend service supplying Candidate_Pool titles — TMDB for Movie, TV Show, and Drama; AniList for Anime.
- **Skin**: The active visual theme of the app, either "Lumen" (Apple-style) or "Anime" (Netflix-style).
- **Detail_Page**: The existing screen that shows full information for a title and provides playback access.

## Requirements

### Requirement 1: Entry Point

**User Story:** As a viewer who cannot decide what to watch, I want a clearly available control to start a recommendation, so that I can get a suggestion without browsing.

#### Acceptance Criteria

1. THE Watch_Recommender SHALL present an Entry_Control labeled to convey a "don't know what to watch" action.
2. WHEN the user activates the Entry_Control, THE Watch_Recommender SHALL display the Category selection.
3. WHERE the active Skin is "Lumen", THE Watch_Recommender SHALL render the Entry_Control using the Lumen visual style.
4. WHERE the active Skin is "Anime", THE Watch_Recommender SHALL render the Entry_Control using the Anime visual style.

### Requirement 2: Category Selection

**User Story:** As a viewer, I want to choose a content category, so that the recommendation matches the kind of content I am in the mood for.

#### Acceptance Criteria

1. THE Watch_Recommender SHALL present exactly four selectable Category options: Movie, TV Show, Anime, and Drama.
2. WHEN the user selects a Category, THE Watch_Recommender SHALL generate a Recommendation for the selected Category.
3. WHILE no Category is selected, THE Watch_Recommender SHALL display no Recommendation.

### Requirement 3: Candidate Sourcing

**User Story:** As a viewer, I want recommendations pulled from popular and trending content, so that the suggestions are relevant and worth watching.

#### Acceptance Criteria

1. WHEN the selected Category is Movie, TV Show, or Drama, THE Watch_Recommender SHALL build the Candidate_Pool from TMDB popular or trending content for that Category.
2. WHEN the selected Category is Anime, THE Watch_Recommender SHALL build the Candidate_Pool from AniList content for that Category using `fetchAnimeByOptions`.
3. THE Watch_Recommender SHALL represent every Candidate_Pool title as a Movie_Object.
4. WHEN a Candidate_Pool contains at least one title, THE Watch_Recommender SHALL select exactly one title from that Candidate_Pool as the Recommendation.
5. WHEN selecting a Recommendation from a Candidate_Pool containing two or more titles, THE Watch_Recommender SHALL choose the title using a randomized selection.

### Requirement 4: Displaying the Recommendation

**User Story:** As a viewer, I want to see the recommended title's key information, so that I can decide whether it appeals to me.

#### Acceptance Criteria

1. WHEN a Recommendation is selected, THE Watch_Recommender SHALL display the Recommendation's poster image.
2. WHEN a Recommendation is selected, THE Watch_Recommender SHALL display the Recommendation's title.
3. WHEN a Recommendation is selected, THE Watch_Recommender SHALL display at least one additional detail from the Movie_Object among release year, genres, and rating.
4. IF the Recommendation's poster image is unavailable, THEN THE Watch_Recommender SHALL display a placeholder image in its place.
5. WHEN a Recommendation is selected, THE Watch_Recommender SHALL identify the Category to which the Recommendation belongs.

### Requirement 5: Acting on the Recommendation

**User Story:** As a viewer, I want to open or play the recommended title, so that I can start watching immediately.

#### Acceptance Criteria

1. WHEN a Recommendation is displayed, THE Watch_Recommender SHALL present a control to open the Recommendation's Detail_Page.
2. WHEN the user activates the open-details control, THE Watch_Recommender SHALL navigate to the Detail_Page for the Recommendation.
3. WHEN the user activates the open-details control, THE Watch_Recommender SHALL pass the Recommendation's Movie_Object to the Detail_Page so that playback uses the existing navigation flow.

### Requirement 6: Requesting Another Recommendation

**User Story:** As a viewer, I want to ask for a different suggestion, so that I can keep looking until something appeals to me.

#### Acceptance Criteria

1. WHEN a Recommendation is displayed, THE Watch_Recommender SHALL present a Shuffle_Control.
2. WHEN the user activates the Shuffle_Control, THE Watch_Recommender SHALL select a new Recommendation from the Candidate_Pool of the currently selected Category.
3. WHERE the Candidate_Pool contains two or more titles, WHEN the user activates the Shuffle_Control, THE Watch_Recommender SHALL select a Recommendation different from the currently displayed Recommendation.
4. WHEN the user activates the Shuffle_Control, THE Watch_Recommender SHALL retain the currently selected Category.

### Requirement 7: Loading State

**User Story:** As a viewer, I want feedback while a recommendation is being prepared, so that I know the app is working.

#### Acceptance Criteria

1. WHILE the Watch_Recommender is retrieving a Candidate_Pool, THE Watch_Recommender SHALL display a loading indicator.
2. WHEN retrieval of the Candidate_Pool completes, THE Watch_Recommender SHALL remove the loading indicator.

### Requirement 8: Error and Empty-Result Handling

**User Story:** As a viewer, I want a clear message when a recommendation cannot be produced, so that I understand what happened and can try again.

#### Acceptance Criteria

1. IF retrieval of a Candidate_Pool from a Data_Source fails, THEN THE Watch_Recommender SHALL display an error message and offer a retry action.
2. IF a Candidate_Pool for the selected Category contains no titles, THEN THE Watch_Recommender SHALL display a message indicating that no Recommendation is available for that Category.
3. WHEN the user activates the retry action after a failure, THE Watch_Recommender SHALL attempt to retrieve the Candidate_Pool for the selected Category again.

### Requirement 9: Responsive and Skin-Aware Presentation

**User Story:** As a viewer on any device, I want the recommender to look right in my current skin and screen size, so that the experience is consistent with the rest of the app.

#### Acceptance Criteria

1. THE Watch_Recommender SHALL render its Category selection, Recommendation display, and controls in a mobile-first layout.
2. WHERE the viewport width corresponds to a desktop layout, THE Watch_Recommender SHALL adapt its layout for desktop presentation.
3. WHERE the active Skin is "Lumen", THE Watch_Recommender SHALL apply the Lumen visual style to the Recommendation display and controls.
4. WHERE the active Skin is "Anime", THE Watch_Recommender SHALL apply the Anime visual style to the Recommendation display and controls.

### Requirement 10: Preference Refinement (Optional Scope)

**User Story:** As a viewer with a preference, I want to optionally narrow recommendations by genre or mood, so that suggestions better match what I want to watch.

#### Acceptance Criteria

1. WHERE preference refinement is enabled, THE Watch_Recommender SHALL present optional genre or mood options for the selected Category.
2. WHERE preference refinement is enabled AND the user selects a preference, THE Watch_Recommender SHALL restrict the Candidate_Pool to titles matching the selected preference.
3. WHERE preference refinement is enabled AND the user selects no preference, THE Watch_Recommender SHALL build the Candidate_Pool from popular or trending content for the selected Category.
4. WHERE preference refinement is enabled AND a preference-restricted Candidate_Pool contains no titles, THEN THE Watch_Recommender SHALL display a message indicating that no Recommendation matches the selected preference.
