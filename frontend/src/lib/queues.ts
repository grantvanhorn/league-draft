const QUEUE_LABELS: Record<number, string> = {
  0: "Custom",
  400: "Normal",
  410: "Ranked Dyn",
  420: "Ranked Solo",
  430: "Blind",
  440: "Ranked Flex",
  450: "ARAM",
  480: "Swiftplay",
  490: "Quickplay",
  600: "Blood Hunt",
  700: "Clash",
  710: "Ranked 5s",
  720: "ARAM Clash",
  900: "URF",
  910: "Ascension",
  920: "Poro King",
  940: "Nexus Siege",
  1020: "One for All",
  1200: "Nexus Blitz",
  1300: "Nexus Blitz",
  1400: "Spellbook",
  1700: "Arena",
  1710: "Arena",
  1810: "Swarm",
  1820: "Swarm",
  1830: "Swarm",
  1840: "Swarm",
  1900: "Pick URF",
  2300: "Brawl",
  2400: "ARAM Mayhem",
};

export function queueLabel(id?: number): string {
  if (!id) return "?";
  return QUEUE_LABELS[id] ?? `Mode ${id}`;
}

export function queueShort(id?: number): string {
  return queueLabel(id);
}

export { QUEUE_LABELS };
