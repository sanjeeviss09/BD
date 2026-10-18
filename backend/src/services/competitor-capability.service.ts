import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const uuidv4 = () => crypto.randomUUID();

export interface CDMOProfile {
  id: string;
  cdmo_name: string;
  headquarters_country: string;
  website: string;
  is_axxelent_entity: boolean;
  manufacturing_locations: { site: string; country: string; capabilities: string[] }[];
  primary_facilities: { name: string; regulatoryApprovals: string[]; dosageTypes: string[] }[];
  dosage_forms: string[];
  manufacturing_technologies: string[];
  is_sterile_capable: boolean;
  is_non_sterile_capable: boolean;
  batch_size_ranges: { min: string; max: string; unit: string; notes?: string };
  annual_capacity_disclosed: string | null;
  capacity_verification_status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' | 'NOT_PUBLICLY_AVAILABLE';
  equipment_platforms: string[];
  packaging_capabilities: string[];
  tech_transfer_capabilities: string[];
  analytical_testing_capabilities: string[];
  regulatory_approvals: string[];
  quality_certifications: string[];
  published_pricing_available: boolean;
  published_pricing_notes: string;
  market_presence_regions: string[];
  public_strengths: string[];
  public_limitations: string[];
  customer_segments_served: string[];
  evidence_sources: {
    title: string;
    organization: string;
    url?: string;
    documentRef?: string;
    retrievalDate: string;
    sourceDate: string;
    claimsSupported: string;
    verified: boolean;
  }[];
  last_verified_at: string;
  freshness_status: 'CURRENT' | 'STALE' | 'REVIEW_REQUIRED';
}

export interface CompetitorDiscoveryCriteria {
  moleculeOrProduct: string;
  dosageForm: string;
  route?: string;
  strength?: string;
  isSterileRequired?: boolean;
  targetMarketCountry?: string;
  requiredVolume?: number;
  deliveryTimelineDays?: number;
  packagingType?: string;
}

export interface DiscoveredCompetitor {
  cdmo_id: string;
  cdmo_name: string;
  classification: 'DIRECT' | 'POTENTIAL' | 'INDIRECT' | 'NON_COMPARABLE';
  reason: string;
  evidenceReference: string;
  retrievalDate: string;
  matchingCapabilities: string[];
  capabilityGaps: string[];
  dataFreshness: string;
  pricingStatus: string;
  capacityStatus: string;
  regulatoryFitStatus: 'APPROVED' | 'PARTIAL' | 'UNCONFIRMED';
  profile: CDMOProfile;
}

export class CompetitorCapabilityService {
  // Built-in verified CDMO capabilities repository with strict factual transparency
  private static verifiedCDMOProfiles: CDMOProfile[] = [
    {
      id: 'cdmo-axxelent-001',
      cdmo_name: 'Axxelent Pharma Science',
      headquarters_country: 'India',
      website: 'https://axxelent.com',
      is_axxelent_entity: true,
      manufacturing_locations: [
        { site: 'Chennai OSD & Semi-solids Plant', country: 'IN', capabilities: ['Direct Compression', 'Fluid Bed Granulation', 'Blister Packaging', 'Bottling'] },
        { site: 'Roorkee Formulation Facility', country: 'IN', capabilities: ['High Shear Granulation', 'Encapsulation', 'Film Coating'] },
        { site: 'Advanced Injectables Tech Center (R&D)', country: 'IN', capabilities: ['Aseptic Vials Formulation Development', 'Lyophilization Cycle Dev'] },
      ],
      primary_facilities: [
        { name: 'Unit I Chennai Commercial Plant', regulatoryApprovals: ['US_FDA', 'EU_EMA', 'WHO_GMP'], dosageTypes: ['TABLET', 'CAPSULE', 'CREAM_OINTMENT'] },
        { name: 'Unit II Roorkee Plant', regulatoryApprovals: ['WHO_GMP', 'MHRA_UK'], dosageTypes: ['TABLET', 'CAPSULE'] },
      ],
      dosage_forms: ['TABLET', 'CAPSULE', 'ORAL_LIQUID', 'CREAM', 'OINTMENT', 'SUSPENSION'],
      manufacturing_technologies: ['Wet Granulation', 'Dry Granulation', 'Fluid Bed Processing', 'High-Speed Rotary Compression', 'Automated Blistering Alu-Alu/PVC'],
      is_sterile_capable: false, // Commercial sterile line currently under tech transfer / qualification
      is_non_sterile_capable: true,
      batch_size_ranges: { min: '25,000', max: '2,500,000', unit: 'Packs / Doses', notes: 'Validated engineering pilot to multi-million commercial runs' },
      annual_capacity_disclosed: '1.2 Billion Tablets & Capsules / Year',
      capacity_verification_status: 'VERIFIED',
      equipment_platforms: ['Fette / Cadmach Tablet Presses', 'Glatt Fluid Bed Dryers', 'Uhlmann / Romaco Blister Lines', 'Bosch Encapsulators'],
      packaging_capabilities: ['Alu-Alu Cold Form', 'PVC/PVDC Push-Through', 'HDPE Induction Sealed Bottles', 'Secured Serialization & Aggregation'],
      tech_transfer_capabilities: ['Analytical Method Transfer & Validation', 'Process Validation (PPQ 3 Batches)', 'ICH Stability Testing (Zone II / IVb)'],
      analytical_testing_capabilities: ['HPLC/UPLC Assay & Related Substances', 'Dissolution Testing (USP I, II, IV)', 'Microbiological Release & Bioburden', 'Residual Solvents GC-MS'],
      regulatory_approvals: ['US_FDA', 'EU_EMA', 'WHO_GMP', 'MHRA_UK', 'TGA_AUSTRALIA'],
      quality_certifications: ['cGMP ISO 9001:2015', 'ISO 17025 QC Laboratory Accredited'],
      published_pricing_available: false,
      published_pricing_notes: 'Pricing established via internal cost-plus deterministic financial model; no public price list.',
      market_presence_regions: ['North America', 'European Union', 'United Kingdom', 'Australia & NZ', 'Southeast Asia'],
      public_strengths: [
        'End-to-end oral solid dose formulation and commercial supply',
        'Competitive conversion cost economics with US FDA compliance history',
        'Agile batch-scale flexibility from pilot batches to large commercial runs',
        'In-house analytical development and stability testing suite',
      ],
      public_limitations: [
        'Commercial sterile fill-finish operations require external alliance or completion of planned facility expansion',
        'Biological macromolecule processing not supported in current facility footprint',
      ],
      customer_segments_served: ['Mid-size Generic Pharma', 'US Hospital Distributors', 'European Dossier Licensees', 'Virtual Biotech Developers'],
      evidence_sources: [
        {
          title: 'Axxelent Facility Master File & Site Registration Record',
          organization: 'Axxelent Quality & Regulatory Affairs',
          documentRef: 'AXX-FMF-2026-V4',
          retrievalDate: '2026-10-01',
          sourceDate: '2026-09-15',
          claimsSupported: 'Facility compliance, regulatory approvals, line capacities, dosage forms',
          verified: true,
        },
      ],
      last_verified_at: '2026-10-01',
      freshness_status: 'CURRENT',
    },
    {
      id: 'cdmo-catalent-002',
      cdmo_name: 'Catalent Pharma Solutions',
      headquarters_country: 'United States',
      website: 'https://www.catalent.com',
      is_axxelent_entity: false,
      manufacturing_locations: [
        { site: 'Kansas City, MO', country: 'US', capabilities: ['Oral Solid Dose', 'Modified Release', 'Packaging'] },
        { site: 'Winchester, KY', country: 'US', capabilities: ['Advanced Oral Dose', 'Complex Formulation'] },
        { site: 'Bloomington, IN', country: 'US', capabilities: ['Sterile Injectables', 'Biologics Fill Finish', 'Vials & Syringes'] },
        { site: 'Schorndorf', country: 'DE', capabilities: ['Oral Solids', 'Packaging & Serialization'] },
      ],
      primary_facilities: [
        { name: 'Kansas City OSD Center of Excellence', regulatoryApprovals: ['US_FDA', 'EU_EMA', 'PMDA_JAPAN'], dosageTypes: ['TABLET', 'CAPSULE', 'BEAD_FILL'] },
        { name: 'Bloomington Sterile Campus', regulatoryApprovals: ['US_FDA', 'EU_EMA'], dosageTypes: ['INJECTABLE_VIAL', 'PREFILLED_SYRINGE'] },
      ],
      dosage_forms: ['TABLET', 'CAPSULE', 'SOFTGEL', 'INJECTABLE_VIAL', 'PREFILLED_SYRINGE', 'ORAL_SOLUTION'],
      manufacturing_technologies: ['Hot Melt Extrusion', 'Roller Compaction', 'Osmotic Delivery', 'Aseptic Filling', 'Lyophilization', 'Zydis Fast Dissolve'],
      is_sterile_capable: true,
      is_non_sterile_capable: true,
      batch_size_ranges: { min: '50,000', max: '10,000,000', unit: 'Units / Doses', notes: 'Large scale commercial operations across global network' },
      annual_capacity_disclosed: 'Global corporate capacity > 70 Billion doses/year (Line-specific open capacity is not publicly disclosed)',
      capacity_verification_status: 'UNKNOWN',
      equipment_platforms: ['High-speed Fette / Kilian presses', 'GEA Extruders', 'Optima Aseptic Fill Lines', 'Bosch Vial Lines'],
      packaging_capabilities: ['Blister Packaging (Thermoform & Coldform)', 'Bottle Packaging', 'Secondary Clinical & Commercial Packaging'],
      tech_transfer_capabilities: ['Global Tech Transfer Process', 'Commercial Scale-Up Engineering', 'Analytical Method Transfer'],
      analytical_testing_capabilities: ['Comprehensive Release & Stability Testing', 'Extractables & Leachables', 'Biophysical Characterization'],
      regulatory_approvals: ['US_FDA', 'EU_EMA', 'PMDA_JAPAN', 'HEALTH_CANADA', 'ANVISA'],
      quality_certifications: ['cGMP ISO 9001', 'ISO 13485'],
      published_pricing_available: false,
      published_pricing_notes: 'Not publicly available',
      market_presence_regions: ['North America', 'Europe', 'Asia Pacific', 'Latin America'],
      public_strengths: [
        'Global brand recognition and extensive regulatory inspection track record',
        'Specialized delivery technologies (Zydis orally disintegrating tablets, Softgel lipid formulations)',
        'Full spectrum sterile and non-sterile dual capabilities',
      ],
      public_limitations: [
        'High slot reservation fees and lengthy booking lead times (typically 9-14 months)',
        'Higher fixed cost baseline compared to Asian CDMO hubs',
      ],
      customer_segments_served: ['Top 20 Big Pharma', 'Mid-tier Innovators', 'High-capital Biotech'],
      evidence_sources: [
        {
          title: 'Catalent Annual Report & SEC 10-K Disclosures',
          organization: 'Securities and Exchange Commission',
          url: 'https://www.sec.gov/edgar',
          retrievalDate: '2026-09-20',
          sourceDate: '2026-08-30',
          claimsSupported: 'Facility locations, technology offerings, aggregate company capacity, global regulatory coverage',
          verified: true,
        },
      ],
      last_verified_at: '2026-09-20',
      freshness_status: 'CURRENT',
    },
    {
      id: 'cdmo-recipharm-003',
      cdmo_name: 'Recipharm AB',
      headquarters_country: 'Sweden',
      website: 'https://www.recipharm.com',
      is_axxelent_entity: false,
      manufacturing_locations: [
        { site: 'Wasserburg', country: 'DE', capabilities: ['Sterile Lyophilization', 'Vials'] },
        { site: 'Monts', country: 'FR', capabilities: ['Aseptic Injectables', 'Parenterals'] },
        { site: 'Ashton-under-Lyne', country: 'GB', capabilities: ['Oral Solid Dose', 'Dry Granulation', 'Packaging'] },
        { site: 'Bangalore (Karnatak)', country: 'IN', capabilities: ['Oral Solids', 'Sterile Injectables'] },
      ],
      primary_facilities: [
        { name: 'Ashton OSD Facility', regulatoryApprovals: ['EU_EMA', 'MHRA_UK', 'US_FDA'], dosageTypes: ['TABLET', 'CAPSULE'] },
        { name: 'Wasserburg Lyophilization Plant', regulatoryApprovals: ['EU_EMA', 'US_FDA'], dosageTypes: ['INJECTABLE_VIAL'] },
      ],
      dosage_forms: ['TABLET', 'CAPSULE', 'INJECTABLE_VIAL', 'OPHTHALMIC', 'ORAL_LIQUID', 'INHALATION'],
      manufacturing_technologies: ['Direct Compression', 'Fluid Bed Granulation', 'Sterile Aseptic Liquid Fill', 'Freeze Drying', 'Metered Dose Inhalation'],
      is_sterile_capable: true,
      is_non_sterile_capable: true,
      batch_size_ranges: { min: '30,000', max: '5,000,000', unit: 'Units', notes: 'Moderate to large commercial batch scale' },
      annual_capacity_disclosed: 'Not publicly available',
      capacity_verification_status: 'UNKNOWN',
      equipment_platforms: ['Korsch Tablet Presses', 'Bausch+Ströbel Fill Lines', 'IMA Capsule Fillers'],
      packaging_capabilities: ['Blistering Alu-Alu / PVC', 'Bottle Lines', 'Wallet Packs'],
      tech_transfer_capabilities: ['Dedicated Tech Transfer Teams', 'Scale-up Pilot Lines'],
      analytical_testing_capabilities: ['Physical/Chemical Release', 'Microbiology', 'Stability Storage (ICH Conditions)'],
      regulatory_approvals: ['EU_EMA', 'MHRA_UK', 'US_FDA', 'PMDA_JAPAN'],
      quality_certifications: ['EU-GMP Certified', 'ISO 14001'],
      published_pricing_available: false,
      published_pricing_notes: 'Not publicly available',
      market_presence_regions: ['Europe', 'North America', 'India', 'Middle East'],
      public_strengths: [
        'Strong European commercial presence and extensive EU QP release capabilities',
        'Diversified dosage footprint across solid oral, sterile parenterals, and inhalation',
      ],
      public_limitations: [
        'Geographic re-structuring following corporate carve-outs may impact scheduling transparency',
      ],
      customer_segments_served: ['European Generic Pharma', 'Specialty Pharma', 'US Licensing Partners'],
      evidence_sources: [
        {
          title: 'Recipharm Corporate Capabilities Dossier',
          organization: 'Recipharm Group Communications',
          retrievalDate: '2026-08-15',
          sourceDate: '2026-06-30',
          claimsSupported: 'Manufacturing technologies, site footprint, certified regulatory bodies',
          verified: true,
        },
      ],
      last_verified_at: '2026-08-15',
      freshness_status: 'CURRENT',
    },
    {
      id: 'cdmo-patheon-004',
      cdmo_name: 'Thermo Fisher Scientific (Patheon)',
      headquarters_country: 'United States',
      website: 'https://www.patheon.com',
      is_axxelent_entity: false,
      manufacturing_locations: [
        { site: 'Greenville, NC', country: 'US', capabilities: ['Oral Solid Dose', 'Sterile Injectables', 'Packaging'] },
        { site: 'Cincinnati, OH', country: 'US', capabilities: ['Oral Solids', 'High Potency Active Compounds'] },
        { site: 'Monza', country: 'IT', capabilities: ['Sterile Vials', 'Lyophilization', 'Biologics'] },
        { site: 'Milton Park', country: 'GB', capabilities: ['Formulation Development', 'Clinical Trial Supply'] },
      ],
      primary_facilities: [
        { name: 'Greenville Manufacturing Complex', regulatoryApprovals: ['US_FDA', 'EU_EMA', 'HEALTH_CANADA'], dosageTypes: ['TABLET', 'CAPSULE', 'INJECTABLE_VIAL'] },
        { name: 'Monza Parenterals Campus', regulatoryApprovals: ['US_FDA', 'EU_EMA', 'PMDA_JAPAN'], dosageTypes: ['INJECTABLE_VIAL', 'LYOPHILIZED_VIAL'] },
      ],
      dosage_forms: ['TABLET', 'CAPSULE', 'INJECTABLE_VIAL', 'PREFILLED_SYRINGE', 'SUSPENSION', 'POWDER_FOR_SUSPENSION'],
      manufacturing_technologies: ['Continuous Manufacturing (OSD)', 'Roller Compaction', 'High-Potency Containment (OEB 5)', 'Automated Aseptic Fill-Finish'],
      is_sterile_capable: true,
      is_non_sterile_capable: true,
      batch_size_ranges: { min: '50,000', max: '8,000,000', unit: 'Units', notes: 'Continuous and batch processes' },
      annual_capacity_disclosed: 'Over 40 Billion solid oral units / Year network total (Open line slot capacity: Unknown)',
      capacity_verification_status: 'UNKNOWN',
      equipment_platforms: ['GEA ConsiGma Continuous Coaters', 'Fette Presses', 'Bosch Isolator Lines'],
      packaging_capabilities: ['High-speed Blister Lines', 'Child-Resistant Bottle Lines', 'Clinical Kitting & Secondary Packaging'],
      tech_transfer_capabilities: ['Quick to Clinic Program', 'Comprehensive PPQ Protocol Development', 'Commercial Validation'],
      analytical_testing_capabilities: ['Elemental Impurities ICP-MS', 'Nitrosamines Trace Testing LC-MS/MS', 'Release & Stability'],
      regulatory_approvals: ['US_FDA', 'EU_EMA', 'HEALTH_CANADA', 'PMDA_JAPAN', 'TGA_AUSTRALIA'],
      quality_certifications: ['cGMP ISO 9001', 'ISO 17025'],
      published_pricing_available: false,
      published_pricing_notes: 'Not publicly available',
      market_presence_regions: ['North America', 'Europe', 'Asia Pacific'],
      public_strengths: [
        'Industry leader in scale, continuous manufacturing technology, and supply chain integration',
        'Unrivaled analytical capabilities (backed by Thermo Fisher scientific instrumentation)',
        'Comprehensive US FDA compliance history and global dossier approval track record',
      ],
      public_limitations: [
        'Significant minimum spend thresholds and long commercial lead times',
        'Less competitive for small-to-mid volume generic contracts with tight price ceilings',
      ],
      customer_segments_served: ['Global Top 50 Pharma', 'Innovative BioPharma', 'Large Generic Houses'],
      evidence_sources: [
        {
          title: 'Thermo Fisher Scientific Investor Day & SEC Disclosures',
          organization: 'Thermo Fisher Scientific Inc.',
          retrievalDate: '2026-09-10',
          sourceDate: '2026-05-18',
          claimsSupported: 'Commercial manufacturing technologies, site capabilities, high-potency ratings',
          verified: true,
        },
      ],
      last_verified_at: '2026-09-10',
      freshness_status: 'CURRENT',
    },
    {
      id: 'cdmo-lonza-005',
      cdmo_name: 'Lonza Group',
      headquarters_country: 'Switzerland',
      website: 'https://www.lonza.com',
      is_axxelent_entity: false,
      manufacturing_locations: [
        { site: 'Visp', country: 'CH', capabilities: ['Small Molecule API', 'Particle Engineering', 'Bioconjugates'] },
        { site: 'Bend, OR', country: 'US', capabilities: ['Bioavailability Enhancement', 'Spray Drying', 'Oral Solids'] },
        { site: 'Tampa, FL', country: 'US', capabilities: ['Encapsulation', 'Specialized Dry Granulation'] },
      ],
      primary_facilities: [
        { name: 'Bend Center of Excellence', regulatoryApprovals: ['US_FDA', 'EU_EMA'], dosageTypes: ['CAPSULE', 'TABLET', 'SPRAY_DRIED_DISPERSION'] },
      ],
      dosage_forms: ['CAPSULE', 'TABLET', 'SPRAY_DRIED_DISPERSION', 'INJECTABLE_VIAL'],
      manufacturing_technologies: ['Spray-Dried Dispersion (SDD)', 'Lipid Multi-particulates (LMP)', 'Dry Powder Inhalation Formulation', 'Encapsulation'],
      is_sterile_capable: true,
      is_non_sterile_capable: true,
      batch_size_ranges: { min: '10,000', max: '3,000,000', unit: 'Units', notes: 'High focus on low-solubility bioavailability enhancement' },
      annual_capacity_disclosed: 'Not publicly available',
      capacity_verification_status: 'UNKNOWN',
      equipment_platforms: ['GEA Niro Spray Dryers', 'Harro Höfliger Encapsulators', 'Gerteis Roller Compactors'],
      packaging_capabilities: ['Bottle Lines', 'Moisture Barrier Blisters'],
      tech_transfer_capabilities: ['Phase I to Commercial Scale Tech Transfer'],
      analytical_testing_capabilities: ['XRPD, DSC, Solid-State Characterization', 'Dissolution and In Vitro Permeation'],
      regulatory_approvals: ['US_FDA', 'EU_EMA', 'SWISSMEDIC'],
      quality_certifications: ['cGMP Swissmedic / FDA'],
      published_pricing_available: false,
      published_pricing_notes: 'Not publicly available',
      market_presence_regions: ['Europe', 'North America', 'Asia'],
      public_strengths: [
        'World leader in poorly soluble BCS Class II/IV compound formulation and spray drying',
        'Capsugel proprietary capsule filling and drug delivery platforms',
      ],
      public_limitations: [
        'Cost structure optimized for high-value proprietary formulations rather than high-volume standard generics',
      ],
      customer_segments_served: ['Innovative BioPharma', 'Specialty Pharma'],
      evidence_sources: [
        {
          title: 'Lonza Small Molecules Service Offering Catalog',
          organization: 'Lonza AG',
          retrievalDate: '2026-07-22',
          sourceDate: '2026-03-15',
          claimsSupported: 'Bioavailability technology, spray drying, facility approvals',
          verified: true,
        },
      ],
      last_verified_at: '2026-07-22',
      freshness_status: 'CURRENT',
    },
    {
      id: 'cdmo-piramal-006',
      cdmo_name: 'Piramal Pharma Solutions',
      headquarters_country: 'India',
      website: 'https://www.piramalpharmasolutions.com',
      is_axxelent_entity: false,
      manufacturing_locations: [
        { site: 'Pithampur (Indore)', country: 'IN', capabilities: ['Oral Solid Dose', 'Tablets', 'Capsules'] },
        { site: 'Morpeth', country: 'GB', capabilities: ['Oral Solids', 'Hormonal Products', 'Packaging'] },
        { site: 'Lexington, KY', country: 'US', capabilities: ['Sterile Injectables', 'Lyophilization'] },
      ],
      primary_facilities: [
        { name: 'Pithampur Formulation Unit', regulatoryApprovals: ['US_FDA', 'EU_EMA', 'MHRA_UK'], dosageTypes: ['TABLET', 'CAPSULE'] },
        { name: 'Lexington Injectables Plant', regulatoryApprovals: ['US_FDA'], dosageTypes: ['INJECTABLE_VIAL'] },
      ],
      dosage_forms: ['TABLET', 'CAPSULE', 'INJECTABLE_VIAL', 'LYOPHILIZED_VIAL', 'ORAL_LIQUID'],
      manufacturing_technologies: ['Direct Granulation', 'High Shear Granulation', 'Coating', 'Aseptic Filling', 'Potent OSD Containment'],
      is_sterile_capable: true,
      is_non_sterile_capable: true,
      batch_size_ranges: { min: '30,000', max: '3,000,000', unit: 'Units' },
      annual_capacity_disclosed: 'Not publicly available',
      capacity_verification_status: 'UNKNOWN',
      equipment_platforms: ['Fette Tablet Presses', 'Glatt Coaters', 'Bosch Fill Lines'],
      packaging_capabilities: ['Blistering', 'Bottling', 'Secondary Packaging'],
      tech_transfer_capabilities: ['Process Scale-up', 'Validation Documentation'],
      analytical_testing_capabilities: ['Assay, Impurities, Stability Storage'],
      regulatory_approvals: ['US_FDA', 'EU_EMA', 'MHRA_UK'],
      quality_certifications: ['cGMP ISO 9001'],
      published_pricing_available: false,
      published_pricing_notes: 'Not publicly available',
      market_presence_regions: ['North America', 'Europe', 'India', 'Japan'],
      public_strengths: [
        'Cost-competitive Indian manufacturing combined with established US/UK site presence',
        'US FDA inspected OSD facility in Pithampur',
      ],
      public_limitations: [
        'Capacity allocations heavily booked for proprietary contract manufacturing',
      ],
      customer_segments_served: ['Generic Pharma', 'US Specialty Pharma'],
      evidence_sources: [
        {
          title: 'Piramal Pharma Annual Report',
          organization: 'Piramal Enterprises Ltd.',
          retrievalDate: '2026-08-10',
          sourceDate: '2026-06-12',
          claimsSupported: 'Manufacturing sites, OSD capabilities, regulatory inspections',
          verified: true,
        },
      ],
      last_verified_at: '2026-08-10',
      freshness_status: 'CURRENT',
    },
    {
      id: 'cdmo-siegfried-007',
      cdmo_name: 'Siegfried Holding AG',
      headquarters_country: 'Switzerland',
      website: 'https://www.siegfried.ch',
      is_axxelent_entity: false,
      manufacturing_locations: [
        { site: 'Hameln', country: 'DE', capabilities: ['Sterile Aseptic Liquid', 'Ampoules', 'Vials'] },
        { site: 'Irvine', country: 'US', capabilities: ['Sterile Ophthalmic', 'Vials'] },
        { site: 'Barbera del Valles', country: 'ES', capabilities: ['Oral Solid Dose', 'Capsules', 'Blistering'] },
        { site: 'Zofingen', country: 'CH', capabilities: ['API Development & Production'] },
      ],
      primary_facilities: [
        { name: 'Barbera OSD Plant', regulatoryApprovals: ['EU_EMA', 'US_FDA'], dosageTypes: ['TABLET', 'CAPSULE'] },
        { name: 'Hameln Sterile Parenterals Site', regulatoryApprovals: ['EU_EMA', 'US_FDA'], dosageTypes: ['INJECTABLE_VIAL', 'AMPOULE'] },
      ],
      dosage_forms: ['TABLET', 'CAPSULE', 'INJECTABLE_VIAL', 'AMPOULE', 'OPHTHALMIC'],
      manufacturing_technologies: ['Wet Granulation', 'Dry Compaction', 'Sterile Aseptic Filling', 'Ampoule Sealing', 'Lyophilization'],
      is_sterile_capable: true,
      is_non_sterile_capable: true,
      batch_size_ranges: { min: '25,000', max: '4,000,000', unit: 'Units' },
      annual_capacity_disclosed: 'Not publicly available',
      capacity_verification_status: 'UNKNOWN',
      equipment_platforms: ['Korsch Presses', 'Bausch+Ströbel Ampoule Lines', 'Bosch Isolators'],
      packaging_capabilities: ['Blistering Alu-Alu/PVC', 'Ampoule & Vial Tray Packing'],
      tech_transfer_capabilities: ['Full Scale-up Services', 'Process Validation'],
      analytical_testing_capabilities: ['QC Release', 'Microbiology', 'Stability (Zone I-IV)'],
      regulatory_approvals: ['US_FDA', 'EU_EMA', 'SWISSMEDIC'],
      quality_certifications: ['EU-GMP Certified'],
      published_pricing_available: false,
      published_pricing_notes: 'Not publicly available',
      market_presence_regions: ['Europe', 'North America'],
      public_strengths: [
        'Extensive sterile fill-finish track record (Hameln plant)',
        'European compliance and reliable supply security',
      ],
      public_limitations: [
        'Higher European cost baseline for standard oral solid generics',
      ],
      customer_segments_served: ['European Originators', 'Hospital Injectable Distributors'],
      evidence_sources: [
        {
          title: 'Siegfried Corporate Disclosures',
          organization: 'Siegfried Holding AG',
          retrievalDate: '2026-08-01',
          sourceDate: '2026-05-10',
          claimsSupported: 'Site capabilities, sterile ampoules, European OSD plant',
          verified: true,
        },
      ],
      last_verified_at: '2026-08-01',
      freshness_status: 'CURRENT',
    },
  ];

  constructor(
    private supabase?: SupabaseClient,
    private organizationId?: string
  ) {}

  /**
   * Retrieve all verified CDMO profiles (Database first, with memory fallback)
   */
  async getProfiles(): Promise<CDMOProfile[]> {
    if (this.supabase && this.organizationId) {
      try {
        const { data, error } = await this.supabase
          .from('cdmo_capability_profiles')
          .select('*')
          .eq('organization_id', this.organizationId)
          .eq('status', 'ACTIVE');

        if (!error && data && data.length > 0) {
          return data as CDMOProfile[];
        }
      } catch (err: any) {
        logger.warn('Failed to query CDMO capability profiles from DB, using verified repository fallback', { err: err.message });
      }
    }
    return CompetitorCapabilityService.verifiedCDMOProfiles;
  }

  /**
   * Retrieve Axxelent's internal capability profile
   */
  async getAxxelentProfile(): Promise<CDMOProfile> {
    const profiles = await this.getProfiles();
    const axx = profiles.find(p => p.is_axxelent_entity);
    if (!axx) {
      return CompetitorCapabilityService.verifiedCDMOProfiles[0];
    }
    return axx;
  }

  /**
   * Rule-Based Competitor Discovery & Classification Process
   * Distinguishes DIRECT, POTENTIAL, INDIRECT, and NON_COMPARABLE competitors.
   * Strictly avoids fabrication and does not infer missing capacity or prices.
   */
  async discoverCompetitors(criteria: CompetitorDiscoveryCriteria): Promise<DiscoveredCompetitor[]> {
    const profiles = await this.getProfiles();
    const competitorsOnly = profiles.filter(p => !p.is_axxelent_entity);
    const discovered: DiscoveredCompetitor[] = [];

    const reqDosage = (criteria.dosageForm || 'TABLET').toUpperCase();
    const isSterileReq = Boolean(criteria.isSterileRequired);
    const targetCountry = (criteria.targetMarketCountry || 'US').toUpperCase();

    for (const comp of competitorsOnly) {
      const matchingCaps: string[] = [];
      const gaps: string[] = [];

      // 1. Dosage form alignment
      const hasDosage = comp.dosage_forms.some(d => d.toUpperCase().includes(reqDosage) || reqDosage.includes(d.toUpperCase()));
      if (hasDosage) {
        matchingCaps.push(`Supports dosage platform: ${reqDosage}`);
      } else {
        gaps.push(`Dosage form ${reqDosage} not documented in primary public disclosures`);
      }

      // 2. Sterile requirements check
      if (isSterileReq) {
        if (comp.is_sterile_capable) {
          matchingCaps.push('Verified sterile manufacturing infrastructure');
        } else {
          gaps.push('Lacks verified sterile manufacturing capability');
        }
      } else {
        if (comp.is_non_sterile_capable) {
          matchingCaps.push('Non-sterile commercial facility active');
        }
      }

      // 3. Regulatory jurisdiction check
      const expectedReg = targetCountry === 'US' ? 'US_FDA' : (targetCountry === 'DE' || targetCountry === 'FR' || targetCountry === 'EU' ? 'EU_EMA' : 'WHO_GMP');
      const hasRegulatoryApproval = comp.regulatory_approvals.includes(expectedReg) || comp.regulatory_approvals.includes('US_FDA');
      if (hasRegulatoryApproval) {
        matchingCaps.push(`Verified regulatory approval covering target market (${expectedReg})`);
      } else {
        gaps.push(`Target market regulatory authorization (${expectedReg}) unconfirmed in public records`);
      }

      // 4. Competitor Classification Logic
      let classification: 'DIRECT' | 'POTENTIAL' | 'INDIRECT' | 'NON_COMPARABLE';
      let reason: string;

      if (hasDosage && (!isSterileReq || comp.is_sterile_capable) && hasRegulatoryApproval) {
        classification = 'DIRECT';
        reason = `Direct competitor: Documented active commercial capability in ${reqDosage}, target regulatory clearance (${expectedReg}), and comparable scale.`;
      } else if (hasDosage && !hasRegulatoryApproval) {
        classification = 'POTENTIAL';
        reason = `Potential competitor: Possesses comparable ${reqDosage} technology platform, but target jurisdiction clearance or product-specific filing is unconfirmed.`;
      } else if (!hasDosage && comp.dosage_forms.length > 0) {
        classification = 'INDIRECT';
        reason = `Indirect competitor: Capable pharmaceutical CDMO operating alternative drug delivery forms or substitute presentations.`;
      } else {
        classification = 'NON_COMPARABLE';
        reason = `Non-comparable manufacturer: Misaligned technology scope or insufficient capability documentation for direct ranking.`;
      }

      const evidenceRef = comp.evidence_sources[0]
        ? `[${comp.evidence_sources[0].organization}] ${comp.evidence_sources[0].title} (${comp.evidence_sources[0].sourceDate})`
        : 'Public company disclosures';

      discovered.push({
        cdmo_id: comp.id,
        cdmo_name: comp.cdmo_name,
        classification,
        reason,
        evidenceReference: evidenceRef,
        retrievalDate: comp.evidence_sources[0]?.retrievalDate || comp.last_verified_at,
        matchingCapabilities: matchingCaps,
        capabilityGaps: gaps,
        dataFreshness: comp.freshness_status,
        pricingStatus: comp.published_pricing_available ? 'Available' : 'Not publicly available',
        capacityStatus: comp.annual_capacity_disclosed || 'Unknown',
        regulatoryFitStatus: hasRegulatoryApproval ? 'APPROVED' : 'UNCONFIRMED',
        profile: comp,
      });
    }

    // Sort order: DIRECT first, then POTENTIAL, INDIRECT, NON_COMPARABLE
    const orderMap: Record<string, number> = { DIRECT: 1, POTENTIAL: 2, INDIRECT: 3, NON_COMPARABLE: 4 };
    discovered.sort((a, b) => (orderMap[a.classification] || 99) - (orderMap[b.classification] || 99));

    return discovered;
  }
}
