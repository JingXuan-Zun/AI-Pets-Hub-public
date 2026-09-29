using System;
using UnityEngine;

namespace AiZc2.Runtime
{
    [Serializable]
    public class AvatarRuntimeState
    {
        public string petId = "main";
        public string avatarUrl = "";
        public string currentMotionKey = "";
        public string currentExpressionKey = "";
        public string currentViseme = "";
        public Vector2 lookAtTarget = Vector2.zero;
        public bool visible = true;
        public float scale = 1f;
        public float screenHeight = 0f;
        public float screenWidth = 0f;
        public float viewportHeight = 0f;
        public float viewportWidth = 0f;
        public float viewportX = 0f;
        public float viewportY = 0f;
        public bool dragActive = false;
        public float dragDeltaX = 0f;
        public float dragDeltaY = 0f;
        public string hoverRegion = "";
        public string presentationMode = "default";
    }
}
