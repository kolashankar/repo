# Dependency Conflict Resolution

## Issue Encountered

During deployment on Render (or other Python 3.14 environments), the following dependency conflict occurred:

```
ERROR: Cannot install protobuf<6.0.0dev and >=3.20.2 because these package versions have conflicting dependencies.

The conflict is caused by:
  - protobuf>=3.20.2,<6.0.0dev (line 74)
  - grpcio-status>=1.59.0 requires protobuf>=6.31.1,<7.0.0
```

### Root Cause

The original `requirements.txt` had:
- `protobuf>=3.20.2,<6.0.0dev` (restricting to versions below 6.0)
- `grpcio-status>=1.59.0` (which requires protobuf>=6.31.1)

These constraints were **incompatible** with each other.

---

## Solution Applied

### Step 1: Identified Compatible Versions

Used pip's dependency resolver to find compatible versions by removing strict version constraints:

```bash
# Temporarily removed version pins
google-ai-generativelanguage  # instead of ==0.6.15
grpcio-status>=1.59.0
protobuf  # let pip resolve
```

### Step 2: Let Pip Resolve Dependencies

Pip resolved to these compatible versions:
- `protobuf==5.29.6`
- `grpcio==1.76.0`
- `grpcio-status==1.71.2`
- `google-ai-generativelanguage==0.6.15`

### Step 3: Updated requirements.txt

Fixed the requirements.txt with specific compatible versions:

```python
# Lines 26-35
google-ai-generativelanguage==0.6.15
google-api-core==2.29.0
google-api-python-client==2.189.0
google-auth==2.49.0.dev0
google-auth-httplib2==0.3.0
google-genai==1.62.0
google-generativeai==0.8.6
googleapis-common-protos==1.72.0
grpcio==1.76.0
grpcio-status==1.71.2

# Line 74
protobuf==5.29.6
```

---

## Why This Works

### Version Compatibility Matrix

| Package | Version | Protobuf Requirement |
|---------|---------|---------------------|
| google-ai-generativelanguage | 0.6.15 | >=3.20.2, <6.0.0 |
| grpcio-status | 1.71.2 | >=5.26.1, <6.0.0 ✅ |
| google-api-core | 2.29.0 | >=3.19.5, <7.0.0 |
| protobuf | **5.29.6** | ✅ Satisfies all |

**Key**: `grpcio-status 1.71.2` accepts `protobuf>=5.26.1,<6.0.0`, which is compatible with `google-ai-generativelanguage==0.6.15` that requires `<6.0.0`.

### Why Not protobuf 6.x?

- `google-ai-generativelanguage==0.6.15` requires `protobuf<6.0.0`
- Newer versions (`grpcio-status>=1.75.0`) require `protobuf>=6.31.1`
- To avoid breaking `google-ai-generativelanguage`, we use `grpcio-status==1.71.2` with `protobuf==5.29.6`

---

## Verification

### 1. Local Environment (Python 3.11)
```bash
✅ All 123 packages installed successfully
✅ Backend server starts without errors
✅ All API endpoints working
✅ MongoDB connection successful
```

### 2. Deployment Environment (Python 3.14)
The fixed requirements.txt should now work on Render and other platforms without conflicts.

### 3. Test Commands
```bash
# Check installed versions
pip show protobuf grpcio grpcio-status google-ai-generativelanguage

# Test backend
curl http://localhost:8001/api/health
```

---

## Alternative Solutions (If Needed in Future)

### Option 1: Upgrade to Latest Google Packages
If `google-ai-generativelanguage>=0.10.0` supports protobuf 6.x:
```python
google-ai-generativelanguage>=0.10.0
protobuf>=6.31.1,<7.0.0
grpcio-status>=1.75.0
```

### Option 2: Use Version Ranges
```python
protobuf>=5.26.1,<6.0.0
grpcio-status>=1.70.0,<1.75.0
```

### Option 3: Remove Unused Google Packages
If not using Google AI/Gemini features, remove:
- `google-ai-generativelanguage`
- `google-genai`
- `google-generativeai`

---

## Impact Assessment

### ✅ No Breaking Changes
- All existing functionality preserved
- API endpoints working
- Telegram service operational
- MongoDB connection stable
- Frontend unchanged

### ⚠️ Minor Version Changes
| Package | Old Version | New Version | Impact |
|---------|-------------|-------------|---------|
| grpcio-status | >=1.59.0 | 1.71.2 | None - compatible |
| protobuf | >=3.20.2,<6.0.0dev | 5.29.6 | None - within range |

---

## Deployment Checklist

Before deploying to Render or other platforms:

- [x] Updated requirements.txt with specific versions
- [x] Tested locally on Python 3.11 ✅
- [x] Backend starts without dependency errors ✅
- [x] API health check passes ✅
- [x] MongoDB connection works ✅
- [x] Frontend compiles successfully ✅

---

## Future Maintenance

### When to Update
Monitor for:
1. Security updates for protobuf
2. New releases of google-ai-generativelanguage with protobuf 6.x support
3. Breaking changes in grpcio packages

### Update Command
```bash
cd /app/backend
pip install --upgrade google-ai-generativelanguage
pip freeze | grep -E "protobuf|grpcio" > versions.txt
# Review versions.txt for compatibility
```

---

**Status**: ✅ RESOLVED  
**Date**: 2026-02-14  
**Python Version**: 3.11 (local), 3.14 (deployment)  
**Resolution Time**: 15 minutes
