using System;

namespace AiZc2.Bridge
{
    [Serializable]
    public class AvatarBridgeCommandEnvelope
    {
        public string type = "";
        public string petId = "main";
        public string runtimeKind = "unity";
        public string modelUrl = "";
        public string motionKey = "";
        public string expressionKey = "";
        public string viseme = "";
        public float scale = 1f;
        public float screenHeight = 0f;
        public float screenWidth = 0f;
        public string presentationMode = "default";
        public bool visible = true;
        public float viewportHeight = 0f;
        public float viewportWidth = 0f;
        public float viewportX = 0f;
        public float viewportY = 0f;
        public bool dragActive = false;
        public float dragDeltaX = 0f;
        public float dragDeltaY = 0f;
        public string hoverRegion = "";
        public float lookAtX = 0f;
        public float lookAtY = 0f;
    }
}
