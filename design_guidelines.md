# ANPR México Business Directory - Design Guidelines

## Design Approach
**System-Based**: Professional business directory using shadcn/ui component patterns with Material Design principles for information density and clarity. Reference successful directories like Yelp and Yellow Pages for proven interaction models.

## Typography
- **Headings**: Inter font family - Bold (700) for h1/h2, SemiBold (600) for h3/h4
- **Body**: Inter Regular (400) for content, Medium (500) for emphasis
- **Hierarchy**: H1 (3xl/4xl), H2 (2xl/3xl), H3 (xl), Body (base), Small (sm)

## Layout System
**Tailwind Spacing**: Strict adherence to units 2, 4, 6, 8, 12, 16, 20, 24 for consistency
- **Containers**: max-w-7xl for main content, max-w-6xl for narrower sections
- **Section Padding**: py-16 to py-24 on desktop, py-8 to py-12 on mobile
- **Card Spacing**: p-6 standard, p-8 for featured cards
- **Grid Gaps**: gap-4 for tight layouts, gap-6 for breathing room, gap-8 for separated sections

## Component Library

### Navigation
**Desktop Header**: Full-width sticky header with logo left, search bar center (max-w-xl), login/register right. Height h-16, shadow-sm, backdrop-blur-lg with semi-transparent background.

**Search Bar**: Rounded-full input with search icon left, category dropdown button right. Prominent placement, always visible.

### Hero Section
**Large hero image** (h-96 to h-[500px]) showcasing Mexican business landscape/cityscape. Overlay with gradient-to-r from dark blue (opacity-90) to transparent. Centered content with:
- H1 headline: "Directorio de Negocios en México"
- Subtitle paragraph
- Enhanced search bar (larger, w-full max-w-2xl)
- Blurred-background buttons using backdrop-blur-md bg-white/10 for secondary actions

### Business Listings

**Card View** (default): Grid of lg:grid-cols-3 md:grid-cols-2
- Business image (aspect-video, rounded-t-lg)
- Content section (p-6): business name (font-semibold text-lg), category badge, rating stars with count, address (truncate), CTA button

**List View** (toggle option): Single column with horizontal layout
- Left: square business image (w-32 h-32)
- Center: business info stacked
- Right: rating and CTA button

### Filters Sidebar
**Left sidebar** (w-64 on desktop, drawer on mobile):
- Category checkboxes (nested tree structure)
- Location dropdown
- Rating filter (star buttons)
- "Abierto ahora" toggle
- Price range slider
- Clear filters button

### Business Detail Page
**Multi-section layout**:
1. Hero: Large business image (h-80) with blurred-background overlay containing name, rating, hours, location
2. Two-column grid: Left (2/3 width) - photos gallery, description (rendered HTML), reviews section. Right (1/3) - contact card (phone, address, hours, website link, map embed)
3. Similar businesses carousel at bottom

### Footer
**Three-column** layout (lg:grid-cols-3):
- Column 1: Logo, tagline, social links
- Column 2: Quick links (Categorías, Ciudades, Acerca de)
- Column 3: Newsletter signup form, contact info
- Bottom bar: Copyright, legal links

## Images

**Hero Image**: Mexican business district or iconic cityscape with warm, professional tones. Modern commercial area showing diverse businesses. Place as full-width background image.

**Business Cards**: Square or 16:9 aspect ratio photos representing each business type (storefronts, interiors, products).

**Category Icons**: Use Heroicons for consistent iconography throughout filters and category badges.

## Interactions
- **Hover states**: Cards lift with shadow-lg transition
- **Search**: Real-time suggestions dropdown
- **Filters**: Instant results update without page reload
- **No animations** except smooth transitions (duration-200)

## Rich Text Rendering
Use dangerouslySetInnerHTML equivalent or safe HTML parser. Maintain heading hierarchy, preserve links, render lists and images within business descriptions with proper spacing (prose class).

## Accessibility
- Search bar: aria-label="Buscar negocios"
- Filter checkboxes: proper labels and aria-checked states
- Rating stars: aria-label with numeric rating
- Skip navigation link
- Keyboard navigation for all interactive elements