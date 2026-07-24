/* ---------- Centraliserad konfiguration för SSAO/kontur-postprocessing ----------
   Se brain3d-post.js. En enda config-yta i stället för hårdkodade tal i shader-koden --
   renderBrain3DPostFX läser uAoStrength/uOutlineOpacity om igen varje bildruta, så värdena går
   att ändra live (t.ex. via window.BRAIN3D_RENDER_SETTINGS i konsolen) utan omladdning.
   (Hade tidigare även en "cap"-sektion för en procedurell vävnads-shader på snittlocken --
   reverterad, se konversationen: gjorde att alla lock såg likadana ut i stället för att
   färgkodas per struktur, vilket matchade referensbilderna sämre.) */
window.BRAIN3D_RENDER_SETTINGS = {
  outline: {
    enabled: true,   // togglas via knappen i UI:t, se setBrain3DOutlineEnabled/brain-diagram.js
    opacity: 0.35,
    color: [0.12, 0.11, 0.10]
  },
  ao: {
    strength: 0.55,
    radius: 0.18,
    bias: 0.02
  }
};
