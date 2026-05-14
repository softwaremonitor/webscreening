#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { PrismaClient } from "@prisma/client";
import { parseKeyword } from "../src/lib/keywords";

const prisma = new PrismaClient();

interface Seed {
  name: string;
  url: string;
  lang?: string;
}

const SOURCES: Seed[] = [
  // International / English
  { name: "Packaging World", url: "https://www.packworld.com", lang: "en" },
  { name: "Packaging Digest", url: "https://www.packagingdigest.com", lang: "en" },
  { name: "Packaging Europe", url: "https://packagingeurope.com", lang: "en" },
  { name: "Packaging Gateway", url: "https://www.packaging-gateway.com", lang: "en" },
  { name: "Packaging Strategies", url: "https://www.packagingstrategies.com", lang: "en" },
  { name: "Canadian Packaging", url: "https://www.canadianpackaging.com", lang: "en" },
  { name: "Food Packaging Forum", url: "https://www.foodpackagingforum.org", lang: "en" },
  { name: "Labels & Labeling", url: "https://www.labelsandlabeling.com", lang: "en" },
  { name: "FlexPack Mag", url: "https://www.flexpackmag.com", lang: "en" },
  { name: "PETplanet", url: "https://www.petpla.net", lang: "en" },
  { name: "Plastics in Packaging", url: "https://plasticsinpackaging.com", lang: "en" },
  { name: "Paper First", url: "https://www.paperfirst.info", lang: "en" },
  { name: "Healthcare Packaging", url: "https://www.healthcarepackaging.com", lang: "en" },
  { name: "Contract Packaging Assoc.", url: "https://www.contractpackaging.org", lang: "en" },

  // France
  { name: "Emballages Magazine", url: "https://www.emballagesmagazine.com", lang: "fr" },
  { name: "Emballage Digest", url: "https://www.emballagedigest.fr", lang: "fr" },
  { name: "Usine Nouvelle — Emballage", url: "https://www.usinenouvelle.com/emballage", lang: "fr" },
  { name: "Info Carton", url: "https://www.info-carton.fr", lang: "fr" },
  { name: "Process Alimentaire", url: "https://www.processalimentaire.com", lang: "fr" },
  { name: "RIA", url: "https://www.ria.fr", lang: "fr" },
  { name: "Industries Cosmétiques", url: "https://www.industries-cosmetiques.fr", lang: "fr" },
  { name: "Cahiers Techniques Pharma", url: "https://www.cahiers-techniques-pharma.com", lang: "fr" },
  { name: "Packinfo", url: "https://www.packinfo.fr", lang: "fr" },

  // Germany
  { name: "Packaging Journal (DE)", url: "https://packaging-journal.de", lang: "de" },
  { name: "Neue Verpackung", url: "https://www.neue-verpackung.de", lang: "de" },
  { name: "PackReport", url: "https://www.packreport.de", lang: "de" },
  { name: "Verpackungsrundschau", url: "https://www.verpackungsrundschau.de", lang: "de" },
  { name: "EUWID Verpackung", url: "https://www.euwid-verpackung.de", lang: "de" },
  { name: "Lebensmittel Praxis", url: "https://lebensmittelpraxis.de", lang: "de" },
  { name: "K-Profi", url: "https://www.k-profi.de", lang: "de" },

  // UK
  { name: "Packaging News (UK)", url: "https://www.packagingnews.co.uk", lang: "en" },
  { name: "The Packaging Portal", url: "https://www.thepackagingportal.com", lang: "en" },
  { name: "Packaging Scotland", url: "https://www.packagingscotland.com", lang: "en" },
  { name: "Food Manufacture UK", url: "https://www.foodmanufacture.co.uk", lang: "en" },
  { name: "Packaging Innovations", url: "https://www.packaginginnovations.com", lang: "en" },

  // Italy
  { name: "ItaliaImballaggio", url: "https://www.italiaimballaggio.it", lang: "it" },
  { name: "Converting Magazine (IT)", url: "https://www.convertingmagazine.it", lang: "it" },
  { name: "PackMedia", url: "https://www.packmedia.net", lang: "it" },
  { name: "Packaging Speaks Green", url: "https://packagingspeaksgreen.com", lang: "it" },

  // Spain
  { name: "Alimarket Envase", url: "https://www.alimarket.es/envase", lang: "es" },
  { name: "Tecnopack", url: "https://tecnopack.es", lang: "es" },
  { name: "Interempresas Envase", url: "https://www.interempresas.net/envase", lang: "es" },

  // EU / Industry associations
  { name: "EPRO Plastics Recycling", url: "https://www.epro-plasticsrecycling.org", lang: "en" },
  { name: "FlexPack Europe", url: "https://www.flexpack-europe.org", lang: "en" },
  { name: "European Bioplastics", url: "https://www.european-bioplastics.org", lang: "en" },
  { name: "Pro Carton", url: "https://www.procarton.com", lang: "en" },
  { name: "ECMA", url: "https://www.ecma.org", lang: "en" },
  { name: "CEFLEX", url: "https://ceflex.eu", lang: "en" },
  { name: "EUROPEN", url: "https://www.europen-packaging.eu", lang: "en" },
  { name: "FEFCO", url: "https://www.fefco.org", lang: "en" },
  { name: "Glass for Europe", url: "https://glassforeurope.com", lang: "en" },
  { name: "Metal Packaging Europe", url: "https://metalpackagingeurope.org", lang: "en" },
  { name: "End Plastic Waste", url: "https://endplasticwaste.org", lang: "en" },
  { name: "Elipso", url: "https://www.elipso.org", lang: "fr" },
  { name: "Citeo", url: "https://www.citeo.com", lang: "fr" },
  { name: "Conseil National de l'Emballage", url: "https://conseilemballage.org", lang: "fr" },
  { name: "Copacel", url: "https://www.copacel.fr", lang: "fr" },
  { name: "All4Pack", url: "https://www.all4pack.com", lang: "fr" },
  {
    name: "EU — Packaging Waste",
    url: "https://environment.ec.europa.eu/topics/waste-and-recycling/packaging-waste_en",
    lang: "en",
  },
  { name: "EFSA", url: "https://www.efsa.europa.eu", lang: "en" },
  { name: "RecyClass", url: "https://recyclass.eu", lang: "en" },
  { name: "Plastics Recycling (APR)", url: "https://plasticsrecycling.org", lang: "en" },
  { name: "Ellen MacArthur Foundation", url: "https://ellenmacarthurfoundation.org", lang: "en" },
  { name: "Sustainable Packaging Coalition", url: "https://sustainablepackaging.org", lang: "en" },

  // Events
  { name: "Interpack", url: "https://www.interpack.com", lang: "en" },
  { name: "Pack Expo", url: "https://www.packexpo.com", lang: "en" },
  { name: "drupa", url: "https://www.drupa.com", lang: "en" },
  { name: "FachPack", url: "https://www.fachpack.de", lang: "de" },
  { name: "Paris Packaging Week", url: "https://www.parispackagingweek.com", lang: "en" },
  { name: "Luxe Pack", url: "https://www.luxepack.com", lang: "en" },
  { name: "Hispack", url: "https://www.hispack.com", lang: "es" },
  { name: "Empack", url: "https://www.empack.nl", lang: "en" },

  // Suppliers
  { name: "Amcor", url: "https://www.amcor.com", lang: "en" },
  { name: "Mondi Group", url: "https://www.mondigroup.com", lang: "en" },
  { name: "Smurfit Westrock", url: "https://www.smurfitwestrock.com", lang: "en" },
  { name: "DS Smith", url: "https://www.dssmith.com", lang: "en" },
  { name: "SIG", url: "https://www.sig.biz", lang: "en" },
  { name: "Tetra Pak", url: "https://www.tetrapak.com", lang: "en" },
  { name: "Berry Global", url: "https://www.berryglobal.com", lang: "en" },
  { name: "Sealed Air", url: "https://www.sealedair.com", lang: "en" },
  { name: "Huhtamaki", url: "https://www.huhtamaki.com", lang: "en" },
  { name: "Constantia Flexibles", url: "https://www.cflex.com", lang: "en" },
  { name: "Packaging of the World", url: "https://packagingoftheworld.com", lang: "en" },
];

const KEYWORDS: string[] = [
  "Amcor",
  '"DS Smith"',
  "Plastipak",
  '"Bottle Collective"',
  "Pulpac",
  "Lactalis",
  "Danone",
  '"Recycled Content"',
  '"Chemical Recycling"',
  "PPWR",
  "EUDR",
  "SIG",
  "Tetrapak",
  "Elopak",
  "Seda",
  "Intraplas",
  "UPM",
  '"Stora Enzo"',
  "MMP",
  "VG",
  "Fuji",
  "Sleever",
  "Unisleeve",
  "Trivium",
  "Envases",
];

async function main() {
  console.log("Seeding sources...");
  for (const s of SOURCES) {
    await prisma.source.upsert({
      where: { homepageUrl: s.url },
      update: { name: s.name, defaultLanguage: s.lang ?? null },
      create: {
        name: s.name,
        homepageUrl: s.url,
        defaultLanguage: s.lang ?? null,
        fetchStrategy: "auto",
        perDayLimit: 10,
        enabled: true,
      },
    });
  }
  console.log(`  → ${SOURCES.length} sources upserted`);

  console.log("Seeding keywords...");
  for (const raw of KEYWORDS) {
    const pk = parseKeyword(raw);
    await prisma.keyword.upsert({
      where: { text: pk.raw },
      update: {},
      create: { text: pk.raw, isPhrase: pk.isPhrase, enabled: true },
    });
  }
  console.log(`  → ${KEYWORDS.length} keywords upserted`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
