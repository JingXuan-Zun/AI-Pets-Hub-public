# AI Desktop Pet sync: while the ComfyUI page is open, the workflow on the canvas is kept, in the
# API format ComfyUI itself produces, in user/default/desktop-pet-sync/. The desktop pet reads it
# before each drawing, so changes made in ComfyUI are used without exporting again.
# No nodes; only the small script in web/.

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
