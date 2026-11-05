"use client";

import dynamic from "next/dynamic";

/**
 * BodyMap cargado bajo demanda (solo en el cliente): la librería anatómica
 * (~140 KB de trazados) no entra en el JavaScript del resto de pantallas.
 * Mismas props que BodyMap.
 */
const BodyMapLazy = dynamic(() => import("@/components/BodyMap"), {
  ssr: false,
  loading: () => null,
});

export default BodyMapLazy;
