export function getRandomColor() {
    let letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

export function getRandomColorName() {
  let colors = [
    "yellow",
    "violet",
    "green",
    "red",
    "rose",
    "pink",
    "fuchsia",
    "purple",
    "indigo",
    "blue",
    "sky",
    "cyan",
    "teal",
    "emerald",
    "lime",
    "amber",
    "orange",
    "stone",
    "neutral",
    "zinc",
    "gray",
    "slate"
  ]
  return colors[Math.floor(Math.random() * colors.length)];
}