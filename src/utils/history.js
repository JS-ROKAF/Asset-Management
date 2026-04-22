import { toKST } from "./date";

export { makeHistory };

function makeHistory(type, asset, prevUser, nextUser, note, offsetMs = 0) {
  return {
    assetId: asset.id,
    assetName: asset.name,
    type,
    from: prevUser ?? "-",
    to: nextUser ?? "-",
    date: toKST(offsetMs),
    note: note || "",
  };
}