// The 148 CSS Color Module Level 4 <named-color> keywords (incl. rebeccapurple), lowercased.
// Deliberately EXCLUDES the CSS-wide keywords transparent/currentColor/inherit/initial/unset/none/
// revert/revert-layer — those are legitimate values, not hardcoded colors, so they're not in this list.
// Static spec data; does not change.
const NAMED = new Set<string>([
  "aliceblue","antiquewhite","aqua","aquamarine","azure","beige","bisque","black","blanchedalmond",
  "blue","blueviolet","brown","burlywood","cadetblue","chartreuse","chocolate","coral","cornflowerblue",
  "cornsilk","crimson","cyan","darkblue","darkcyan","darkgoldenrod","darkgray","darkgreen","darkgrey",
  "darkkhaki","darkmagenta","darkolivegreen","darkorange","darkorchid","darkred","darksalmon",
  "darkseagreen","darkslateblue","darkslategray","darkslategrey","darkturquoise","darkviolet","deeppink",
  "deepskyblue","dimgray","dimgrey","dodgerblue","firebrick","floralwhite","forestgreen","fuchsia",
  "gainsboro","ghostwhite","gold","goldenrod","gray","green","greenyellow","grey","honeydew","hotpink",
  "indianred","indigo","ivory","khaki","lavender","lavenderblush","lawngreen","lemonchiffon","lightblue",
  "lightcoral","lightcyan","lightgoldenrodyellow","lightgray","lightgreen","lightgrey","lightpink",
  "lightsalmon","lightseagreen","lightskyblue","lightslategray","lightslategrey","lightsteelblue",
  "lightyellow","lime","limegreen","linen","magenta","maroon","mediumaquamarine","mediumblue",
  "mediumorchid","mediumpurple","mediumseagreen","mediumslateblue","mediumspringgreen","mediumturquoise",
  "mediumvioletred","midnightblue","mintcream","mistyrose","moccasin","navajowhite","navy","oldlace",
  "olive","olivedrab","orange","orangered","orchid","palegoldenrod","palegreen","paleturquoise",
  "palevioletred","papayawhip","peachpuff","peru","pink","plum","powderblue","purple","rebeccapurple",
  "red","rosybrown","royalblue","saddlebrown","salmon","sandybrown","seagreen","seashell","sienna",
  "silver","skyblue","slateblue","slategray","slategrey","snow","springgreen","steelblue","tan","teal",
  "thistle","tomato","turquoise","violet","wheat","white","whitesmoke","yellow","yellowgreen",
]);

/** True if `v` is exactly a CSS named color (case-insensitive). */
export function isNamedColor(v: string): boolean {
  return NAMED.has(v.toLowerCase());
}
