// Seed library of common US-household maintenance tasks.
// Authored fresh for the Josh Approved home-maintenance app. Intervals are
// sensible defaults in days; users can adjust per task.

export const CATEGORIES = [
  'hvac',
  'plumbing',
  'electrical',
  'appliances',
  'interior',
  'exterior',
  'yard',
  'safety',
  'general',
] as const;

export type CategoryId = typeof CATEGORIES[number];

export interface LibraryTask {
  id: string;
  name: string;
  category: CategoryId;
  intervalDays: number;
  note?: string;
  /** Canonical name of the appliance this task belongs to, when it has one.
   *  Drives the post-add setup step: match an existing appliance by name or
   *  offer a one-tap name-only create. Absent for house-level tasks. */
  appliance?: string;
}

export const CATEGORY_LABEL_KEYS: Record<CategoryId, string> = {
  hvac: 'category.hvac',
  plumbing: 'category.plumbing',
  electrical: 'category.electrical',
  appliances: 'category.appliances',
  interior: 'category.interior',
  exterior: 'category.exterior',
  yard: 'category.yard',
  safety: 'category.safety',
  general: 'category.general',
};

export const LIBRARY: LibraryTask[] = [
  // hvac
  {
    id: 'hvac-filter',
    appliance: 'HVAC system',
    name: 'Replace HVAC filter',
    category: 'hvac',
    intervalDays: 90,
    note: 'More often with pets or allergies. A clogged filter strains the system.',
  },
  {
    id: 'hvac-outdoor-unit',
    appliance: 'HVAC system',
    name: 'Clear debris around outdoor AC unit',
    category: 'hvac',
    intervalDays: 90,
    note: 'Keep about two feet of clearance so the condenser can breathe.',
  },
  {
    id: 'hvac-vent-dust',
    name: 'Dust supply and return vents',
    category: 'hvac',
    intervalDays: 90,
  },
  {
    id: 'hvac-condensate-line',
    appliance: 'HVAC system',
    name: 'Flush AC condensate drain line',
    category: 'hvac',
    intervalDays: 180,
    note: 'A cup of vinegar down the line helps prevent clogs and water damage.',
  },
  {
    id: 'hvac-humidifier-pad',
    appliance: 'HVAC system',
    name: 'Replace furnace humidifier pad',
    category: 'hvac',
    intervalDays: 365,
    note: 'Skip if your furnace has no whole-home humidifier.',
  },
  {
    id: 'hvac-pro-tuneup',
    appliance: 'HVAC system',
    name: 'Schedule HVAC tune-up',
    category: 'hvac',
    intervalDays: 365,
    note: 'Once a year, ideally before the heavy heating or cooling season.',
  },

  // plumbing
  {
    id: 'garbage-disposal-clean',
    appliance: 'Garbage disposal',
    name: 'Clean garbage disposal',
    category: 'plumbing',
    intervalDays: 30,
    note: 'Ice cubes and citrus peel clear buildup and odors.',
  },
  {
    id: 'water-softener-salt',
    appliance: 'Water softener',
    name: 'Check water softener salt level',
    category: 'plumbing',
    intervalDays: 60,
    note: 'Skip if you have no softener. Break up any hard salt crust.',
  },
  {
    id: 'sump-pump-test',
    appliance: 'Sump pump',
    name: 'Test sump pump',
    category: 'plumbing',
    intervalDays: 90,
    note: 'Pour a bucket of water into the pit and confirm the pump kicks on.',
  },
  {
    id: 'under-sink-check',
    name: 'Check under sinks for leaks',
    category: 'plumbing',
    intervalDays: 90,
    note: 'Small drips show up as stains or a warped cabinet floor.',
  },
  {
    id: 'faucet-aerators',
    name: 'Clean faucet aerators and showerheads',
    category: 'plumbing',
    intervalDays: 180,
    note: 'Soak in vinegar to clear mineral buildup.',
  },
  {
    id: 'toilet-leak-test',
    name: 'Check toilets for silent leaks',
    category: 'plumbing',
    intervalDays: 180,
    note: 'Food coloring in the tank. Color in the bowl means the flapper leaks.',
  },
  {
    id: 'main-shutoff-exercise',
    name: 'Exercise main water shutoff valve',
    category: 'plumbing',
    intervalDays: 365,
    note: 'A valve that never moves can seize. You want it working in an emergency.',
  },
  {
    id: 'water-heater-flush',
    appliance: 'Water heater',
    name: 'Flush water heater',
    category: 'plumbing',
    intervalDays: 365,
    note: 'Draining sediment extends tank life and keeps heating efficient.',
  },
  {
    id: 'water-heater-tpr-valve',
    appliance: 'Water heater',
    name: 'Test water heater pressure relief valve',
    category: 'plumbing',
    intervalDays: 365,
    note: 'Lift the lever briefly. Water should flow, then stop cleanly.',
  },

  // electrical
  {
    id: 'gfci-test',
    name: 'Test GFCI outlets',
    category: 'electrical',
    intervalDays: 90,
    note: 'Press test, then reset, on outlets in kitchen, baths, garage, outdoors.',
  },
  {
    id: 'afci-test',
    name: 'Test AFCI breakers',
    category: 'electrical',
    intervalDays: 180,
    note: 'Press the test button on each arc-fault breaker in the panel.',
  },
  {
    id: 'cord-check',
    name: 'Check cords and power strips for wear',
    category: 'electrical',
    intervalDays: 180,
    note: 'Replace anything frayed, pinched, or warm to the touch.',
  },
  {
    id: 'outdoor-outlet-covers',
    name: 'Check outdoor outlet covers',
    category: 'electrical',
    intervalDays: 365,
    note: 'Covers should close fully and keep water out.',
  },
  {
    id: 'panel-inspect',
    name: 'Inspect electrical panel',
    category: 'electrical',
    intervalDays: 365,
    note: 'Look for rust, scorch marks, or a burning smell. Call a pro if found.',
  },

  // appliances
  {
    id: 'dishwasher-filter',
    appliance: 'Dishwasher',
    name: 'Clean dishwasher filter',
    category: 'appliances',
    intervalDays: 30,
    note: 'Twist out the filter at the tub bottom and rinse. Stops odors and film.',
  },
  {
    id: 'range-hood-filter',
    appliance: 'Range hood',
    name: 'Degrease range hood filter',
    category: 'appliances',
    intervalDays: 90,
    note: 'Most metal filters can go through the dishwasher.',
  },
  {
    id: 'fridge-coils',
    appliance: 'Refrigerator',
    name: 'Vacuum refrigerator coils',
    category: 'appliances',
    intervalDays: 180,
    note: 'Dusty coils make the compressor work harder.',
  },
  {
    id: 'fridge-door-gaskets',
    appliance: 'Refrigerator',
    name: 'Check refrigerator door gaskets',
    category: 'appliances',
    intervalDays: 180,
    note: 'A dollar bill should drag when pulled from the closed door.',
  },
  {
    id: 'fridge-water-filter',
    appliance: 'Refrigerator',
    name: 'Replace refrigerator water filter',
    category: 'appliances',
    intervalDays: 180,
    note: 'Skip if your fridge has no water or ice dispenser.',
  },
  {
    id: 'oven-deep-clean',
    appliance: 'Oven',
    name: 'Deep clean oven',
    category: 'appliances',
    intervalDays: 180,
  },
  {
    id: 'washer-hoses',
    appliance: 'Washing machine',
    name: 'Inspect washing machine hoses',
    category: 'appliances',
    intervalDays: 180,
    note: 'Bulges or cracks mean replace now. A burst hose floods fast.',
  },
  {
    id: 'dryer-vent-clean',
    appliance: 'Dryer',
    name: 'Deep clean dryer vent duct',
    category: 'appliances',
    intervalDays: 365,
    note: 'Lint in the duct is a fire risk. Clean from the dryer to the outside cap.',
  },

  // interior
  {
    id: 'bath-fan-clean',
    name: 'Clean bathroom exhaust fans',
    category: 'interior',
    intervalDays: 180,
    note: 'A dusty fan cannot clear moisture, which invites mold.',
  },
  {
    id: 'ceiling-fans',
    name: 'Dust ceiling fans and reverse direction',
    category: 'interior',
    intervalDays: 180,
    note: 'Blades should push air down in summer and pull it up in winter.',
  },
  {
    id: 'tub-caulk-check',
    name: 'Inspect tub and shower caulk',
    category: 'interior',
    intervalDays: 180,
    note: 'Recaulk gaps before water reaches the wall behind the tile.',
  },
  {
    id: 'attic-check',
    name: 'Inspect attic for leaks and pests',
    category: 'interior',
    intervalDays: 180,
    note: 'Look for daylight, water stains, and droppings.',
  },
  {
    id: 'carpet-deep-clean',
    name: 'Deep clean carpets',
    category: 'interior',
    intervalDays: 365,
  },
  {
    id: 'door-hinge-lube',
    name: 'Lubricate door hinges and locks',
    category: 'interior',
    intervalDays: 365,
  },

  // exterior
  {
    id: 'garage-door-lube',
    appliance: 'Garage door',
    name: 'Lubricate garage door hardware',
    category: 'exterior',
    intervalDays: 180,
    note: 'Rollers, hinges, and springs. Skip the track itself.',
  },
  {
    id: 'gutter-clean',
    name: 'Clean gutters and downspouts',
    category: 'exterior',
    intervalDays: 180,
    note: 'More often under heavy tree cover. Clogs back water into roof and walls.',
  },
  {
    id: 'roof-check',
    name: 'Inspect roof from the ground',
    category: 'exterior',
    intervalDays: 180,
    note: 'Look for lifted or missing shingles, especially after storms.',
  },
  {
    id: 'deck-check',
    name: 'Inspect deck boards and railings',
    category: 'exterior',
    intervalDays: 365,
    note: 'Probe for soft wood and tighten loose fasteners. Reseal as needed.',
  },
  {
    id: 'exterior-caulk',
    name: 'Check caulk around windows and doors',
    category: 'exterior',
    intervalDays: 365,
    note: 'Gaps let in water and drafts. Recaulk where it has pulled away.',
  },
  {
    id: 'foundation-check',
    name: 'Inspect foundation for cracks',
    category: 'exterior',
    intervalDays: 365,
    note: 'Hairline cracks are normal. Widening or stair-step cracks need a pro.',
  },
  {
    id: 'siding-wash',
    name: 'Wash siding',
    category: 'exterior',
    intervalDays: 365,
  },
  {
    id: 'winterize-spigots',
    name: 'Winterize outdoor faucets',
    category: 'exterior',
    intervalDays: 365,
    note: 'Disconnect hoses and drain the lines before the first hard freeze.',
  },

  // yard
  {
    id: 'sprinkler-check',
    appliance: 'Sprinkler system',
    name: 'Check sprinkler heads and coverage',
    category: 'yard',
    intervalDays: 90,
    note: 'In season. A stuck head wastes water or drowns one patch.',
  },
  {
    id: 'drainage-check',
    name: 'Check yard drainage and grading',
    category: 'yard',
    intervalDays: 180,
    note: 'Soil should slope away from the foundation. Watch where water pools.',
  },
  {
    id: 'trim-vegetation',
    name: 'Trim shrubs and trees away from the house',
    category: 'yard',
    intervalDays: 180,
    note: 'Growth touching siding or roof invites pests and traps moisture.',
  },
  {
    id: 'aerate-lawn',
    name: 'Aerate lawn',
    category: 'yard',
    intervalDays: 365,
  },
  {
    id: 'fence-check',
    name: 'Inspect fence and gates',
    category: 'yard',
    intervalDays: 365,
    note: 'Look for leaning posts, rot, and sagging gate hinges.',
  },
  {
    id: 'mower-blade-sharpen',
    appliance: 'Lawn mower',
    name: 'Sharpen lawn mower blade',
    category: 'yard',
    intervalDays: 365,
    note: 'A dull blade tears grass and browns the tips.',
  },

  // safety
  {
    id: 'fire-extinguisher-check',
    name: 'Check fire extinguisher gauge',
    category: 'safety',
    intervalDays: 90,
    note: 'Needle in the green. Replace or recharge if not.',
  },
  {
    id: 'co-detector-test',
    name: 'Test carbon monoxide detectors',
    category: 'safety',
    intervalDays: 180,
  },
  {
    id: 'garage-door-reverse',
    appliance: 'Garage door',
    name: 'Test garage door auto-reverse',
    category: 'safety',
    intervalDays: 180,
    note: 'The door should reverse when it meets a board laid flat under it.',
  },
  {
    id: 'smoke-detector-test',
    name: 'Test smoke detectors',
    category: 'safety',
    intervalDays: 180,
    note: 'Hold the test button on every unit until it sounds.',
  },
  {
    id: 'detector-batteries',
    name: 'Replace smoke and CO detector batteries',
    category: 'safety',
    intervalDays: 365,
    note: 'Yearly even if they still test fine. Sealed 10 year units are exempt.',
  },
  {
    id: 'emergency-kit',
    name: 'Restock emergency kit',
    category: 'safety',
    intervalDays: 365,
    note: 'Water, food, meds, flashlight batteries. Check expiration dates.',
  },
  {
    id: 'escape-plan',
    name: 'Review fire escape plan',
    category: 'safety',
    intervalDays: 365,
    note: 'Two ways out of every bedroom and a meeting spot outside.',
  },
  {
    id: 'radon-test',
    name: 'Test home for radon',
    category: 'safety',
    intervalDays: 730,
    note: 'Kits are cheap. Retest every few years or after major renovations.',
  },

  // general
  {
    id: 'trash-bin-wash',
    name: 'Wash trash and recycling bins',
    category: 'general',
    intervalDays: 90,
  },
  {
    id: 'lock-check',
    name: 'Test window and door locks',
    category: 'general',
    intervalDays: 180,
  },
  {
    id: 'pest-walkaround',
    name: 'Walk the house for pest entry points',
    category: 'general',
    intervalDays: 180,
    note: 'Seal gaps around pipes and vents. Watch for droppings or chewed wood.',
  },
  {
    id: 'home-inventory',
    name: 'Update home inventory for insurance',
    category: 'general',
    intervalDays: 365,
    note: 'A quick video of each room makes claims far easier.',
  },
  {
    id: 'paint-touchup',
    name: 'Touch up interior and exterior paint',
    category: 'general',
    intervalDays: 365,
    note: 'Bare spots outside let moisture into the wood.',
  },
];
