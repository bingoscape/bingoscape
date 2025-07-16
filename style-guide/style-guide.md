# BingoScape Design System Style Guide

## Color Palette

### Primary Colors
* **Primary Dark** - `#0A0A0A` (Main background, deep charcoal for immersive dark experience)
* **Primary Light** - `#FFFFFF` (Primary text, high contrast elements)
* **Secondary Dark** - `#1A1A1A` (Card backgrounds, elevated surfaces)

### Accent Colors
* **Success Green** - `#22C55E` (Active states, success indicators, "Active" badges)
* **Accent Green Light** - `#4ADE80` (Hover states, secondary green elements)
* **Warning Red** - `#EF4444` (Error states, "Closed" indicators)

### Functional Colors
* **Muted Gray** - `#6B7280` (Secondary text, subtle information)
* **Border Gray** - `#374151` (Borders, dividers, card outlines)
* **Hover Gray** - `#2D3748` (Hover states for dark elements)

### Gaming Theme Colors
* **Fantasy Blue** - `#3B82F6` (Links, interactive elements)
* **Quest Gold** - `#F59E0B` (Highlights, special indicators)
* **Mystical Purple** - `#8B5CF6` (Premium features, special content)

## Typography

### Font Family
* **Primary Font**: System UI, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
* **Gaming Accent**: Inter (for headings and special elements)

### Font Weights
* **Regular**: 400 (Body text, standard content)
* **Medium**: 500 (Buttons, tab labels, secondary headings)
* **Semibold**: 600 (Card titles, important labels)
* **Bold**: 700 (Main headings, primary emphasis)

### Text Styles

#### Headings
* **H1**: 32px/40px, Bold, Letter spacing -0.5px
   * Used for page titles like "Your Events"
* **H2**: 24px/32px, Bold, Letter spacing -0.3px
   * Used for section headers like "Bingos", "Teams"
* **H3**: 20px/28px, Semibold, Letter spacing -0.2px
   * Used for card titles like "TestBingo", event names
* **H4**: 18px/24px, Medium, Letter spacing -0.1px
   * Used for sub-sections and component headers

#### Body Text
* **Body Large**: 16px/24px, Regular, Letter spacing 0px
   * Primary content text, descriptions
* **Body**: 14px/20px, Regular, Letter spacing 0px
   * Standard UI text, form labels
* **Body Small**: 12px/16px, Regular, Letter spacing 0.1px
   * Secondary information, metadata

#### Special Text
* **Button Text**: 14px/20px, Medium, Letter spacing 0.1px
   * All interactive button labels
* **Tab Text**: 14px/20px, Medium, Letter spacing 0px
   * Navigation tabs and filters
* **Badge Text**: 12px/16px, Medium, Letter spacing 0.2px
   * Status indicators, counters
* **Caption**: 11px/16px, Regular, Letter spacing 0.3px
   * Timestamps, fine print

## Component Styling

### Navigation
* **Background**: Primary Dark (`#0A0A0A`)
* **Height**: 64px
* **Brand Text**: 20px, Bold, Primary Light
* **Nav Links**: 14px, Medium, Muted Gray
* **Active Link**: Primary Light
* **Padding**: 16px horizontal

### Buttons
* **Primary Button**
   * Background: Primary Light (`#FFFFFF`)
   * Text: Primary Dark (`#0A0A0A`)
   * Height: 40px
   * Padding: 12px 20px
   * Border Radius: 6px
   * Font: 14px, Medium

* **Secondary Button**
   * Background: Secondary Dark (`#1A1A1A`)
   * Text: Primary Light (`#FFFFFF`)
   * Border: 1px solid Border Gray (`#374151`)
   * Height: 40px
   * Padding: 12px 20px
   * Border Radius: 6px

* **Icon Button**
   * Background: Transparent
   * Text: Muted Gray (`#6B7280`)
   * Hover: Hover Gray (`#2D3748`)
   * Size: 32px x 32px
   * Border Radius: 4px

### Cards
* **Background**: Secondary Dark (`#1A1A1A`)
* **Border**: 1px solid Border Gray (`#374151`)
* **Border Radius**: 8px
* **Padding**: 20px
* **Shadow**: Subtle inner shadow for depth

### Badges/Status Indicators
* **Active Badge**
   * Background: Success Green (`#22C55E`)
   * Text: Primary Light (`#FFFFFF`)
   * Height: 24px
   * Padding: 4px 8px
   * Border Radius: 4px
   * Font: 12px, Medium

* **Inactive Badge**
   * Background: Border Gray (`#374151`)
   * Text: Muted Gray (`#6B7280`)
   * Same sizing as active

### Tabs
* **Tab Container**: Border bottom 1px Border Gray
* **Active Tab**: 
   * Text: Primary Light (`#FFFFFF`)
   * Border bottom: 2px Success Green (`#22C55E`)
   * Background: Secondary Dark (`#1A1A1A`)
* **Inactive Tab**:
   * Text: Muted Gray (`#6B7280`)
   * Hover: Hover Gray (`#2D3748`)
* **Height**: 48px
* **Padding**: 12px 16px

### Bingo Grid
* **Grid Container**: 5x5 grid layout
* **Tile Size**: 80px x 80px
* **Tile Border**: 2px solid Border Gray (`#374151`)
* **Tile Radius**: 4px
* **Tile Hover**: Border color changes to Success Green
* **Tile Active**: Border Success Green, subtle glow effect

### Form Elements
* **Input Fields**
   * Background: Secondary Dark (`#1A1A1A`)
   * Border: 1px solid Border Gray (`#374151`)
   * Focus Border: 2px solid Success Green (`#22C55E`)
   * Height: 40px
   * Padding: 8px 12px
   * Border Radius: 6px
   * Text: Primary Light (`#FFFFFF`)
   * Placeholder: Muted Gray (`#6B7280`)

## Icons
* **Primary Size**: 16px x 16px (inline with text)
* **Secondary Size**: 20px x 20px (standalone buttons)
* **Large Size**: 24px x 24px (navigation, headers)
* **Primary Color**: Muted Gray (`#6B7280`)
* **Active Color**: Success Green (`#22C55E`)
* **Style**: Outline style, consistent stroke width

## Spacing System
* **2px** - Micro spacing (icon gaps)
* **4px** - Tiny spacing (badge padding)
* **8px** - Small spacing (button padding vertical)
* **12px** - Default spacing (form padding)
* **16px** - Medium spacing (card padding, nav padding)
* **20px** - Large spacing (card internal padding)
* **24px** - Extra large spacing (section gaps)
* **32px** - Page spacing (major section separation)

## Motion & Animation
* **Micro Transitions**: 150ms ease-out (hover states)
* **Standard Transitions**: 200ms ease-in-out (tab switches)
* **Smooth Interactions**: 300ms ease-out (modal opens)
* **Page Transitions**: 250ms cubic-bezier(0.4, 0, 0.2, 1)

## Dark Mode Implementation
This application uses a dark-first approach with:
* **Deep Background**: Creates immersive gaming experience
* **High Contrast Text**: Ensures readability during extended use
* **Subtle Borders**: Defines sections without harsh lines
* **Green Accents**: Provides gaming aesthetic while maintaining accessibility
* **Consistent Elevation**: Uses subtle shadows and borders to create depth

## Design Principles
* **Gaming-First**: Dark theme optimized for extended gameplay sessions
* **Clear Hierarchy**: Bold typography and consistent spacing create obvious content structure
* **Accessibility**: High contrast ratios and clear interactive states
* **Efficiency**: Clean, minimal design reduces cognitive load
* **Consistency**: Systematic approach to colors, typography, and spacing across all components