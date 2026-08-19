import { defaultTheme } from "@xstyled/system";

export const OpenSansFontLink = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet">
`;

/**
 * Stand-in faces for the RPW brand until Josh's licensed files are embedded:
 * Oswald stands in for DDC Hardware 45 (condensed industrial display), and
 * Nunito Sans for Avenir (humanist geometric body). The real faces are named
 * first in the CSS stacks, so embedding them is all that is needed to switch.
 */
export const RpwFontLink = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Nunito+Sans:ital,opsz,wght@0,6..12,300..800;1,6..12,300..800&display=swap" rel="stylesheet">
`;

export const theme = {
  ...defaultTheme,
}