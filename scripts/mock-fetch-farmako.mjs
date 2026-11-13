// Preload uji: menggantikan fetch ke PubChem/RxNav/ChEMBL/openFDA dengan respons palsu BERBENTUK dokumentasi (bukan data nyata).
// Hanya memeriksa logika kode (parsing, pemilihan, penyimpanan, penanganan galat) — BUKAN bukti layanan asli bekerja.
const real = globalThis.fetch;
const J = (x, s = 200) => new Response(JSON.stringify(x), { status: s, headers: { "content-type": "application/json" } });
globalThis.fetch = async (url, o) => {
  const u = decodeURIComponent(String(url));
  if (u.includes("pubchem")) {
    if (u.includes("ZZ-FAIL") || u.includes("ZZ-UJI Beta")) return J({}, 500);
    if (u.includes("ZZ-UJI Gamma")) return J({ Fault: {} }, 404);
    if (u.includes("/property/")) return J({ PropertyTable: { Properties: [{ CID: 12345, MolecularFormula: "C0H0", MolecularWeight: "100.0", InChIKey: "AAAA-BBBB-N", IUPACName: "nama-uji" }] } });
    if (u.includes("/synonyms/")) return J({ InformationList: { Information: [{ Synonym: ["SinonimUji", "CHEMBL123", "50-00-0", "AlamUji"] }] } });
  }
  if (u.includes("rxnav")) {
    if (u.includes("rxcui.json")) return J({ idGroup: { rxnormId: ["999"] } });
    if (u.includes("related.json")) return J({ relatedGroup: { conceptGroup: [{ tty: "BN", conceptProperties: [{ name: "MerekUjiRx" }] }] } });
  }
  if (u.includes("api.fda.gov")) {
    if (u.includes("ZZ-UJI Delta")) return J({}, 500);
    const label = (gn, extra = {}) => ({ set_id: "SET-" + gn.replace(/\W/g, ""), openfda: { generic_name: [gn], brand_name: ["MerkOF"], route: ["ORAL"], pharm_class_epc: ["Kelas Uji [EPC]"], pharm_class_moa: ["Penghambat Uji [MoA]"] }, indications_and_usage: ["1 INDICATIONS AND USAGE Obat ini diindikasikan untuk uji."], contraindications: ["CONTRAINDICATIONS Kontra uji."], adverse_reactions: ["Efek uji."], drug_interactions: ["Interaksi uji."], ...extra });
    if (u.includes("ZZ-UJI Alfa")) return J({ results: [label("ZZ-UJI ALFA HYDROCHLORIDE", { indications_and_usage: ["Versi lain."] }), label("ZZ-UJI ALFA")] });
    if (u.includes("ZZ-UJI Beta")) return J({ results: [label("ZZ-UJI BETA AND OTHER")] });
    if (u.includes("aspirin")) return J({ results: [label("ASPIRIN")] });
    return J({ error: { code: "NOT_FOUND" } }, 404);
  }
  if (u.includes("ebi.ac.uk/chembl")) {
    const hit = u.includes("ZZ-UJI Alfa") || u.includes("aspirin") || u.includes("CHEMBLZ1");
    if (u.includes("molecule.json")) return J({ molecules: hit ? [{ molecule_chembl_id: "CHEMBLZ1", pref_name: "X", molecule_synonyms: [{ molecule_synonym: "SinChembl" }, { molecule_synonym: "CHEMBL999" }] }] : [] });
    if (u.includes("molecule/search.json")) return J({ molecules: [] });
    if (u.includes("mechanism.json")) return J({ mechanisms: [{ mechanism_of_action: "Inhibitor uji", target_chembl_id: "CHEMBLT1" }] });
    if (u.includes("target.json")) return J({ targets: [{ target_chembl_id: "CHEMBLT1", pref_name: "Enzim Uji", organism: "Homo sapiens" }] });
  }
  return real(url, o);
};
