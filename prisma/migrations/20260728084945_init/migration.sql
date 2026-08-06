-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'FARMER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "locationDescription" TEXT NOT NULL,
    "introduction" TEXT NOT NULL DEFAULT '',
    "philosophy" TEXT NOT NULL DEFAULT '',
    "farmingMethod" TEXT NOT NULL DEFAULT '',
    "certificationInfo" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT NOT NULL DEFAULT '',
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Farm_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FarmMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'VIEW',
    CONSTRAINT "FarmMember_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FarmMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Plot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" REAL,
    "areaUnit" TEXT,
    "locationDescription" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Plot_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CropVariety" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "CropVariety_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Planting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plotId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "cropVarietyId" TEXT,
    "plantedAt" DATETIME,
    "expectedHarvestAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "Planting_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Planting_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Planting_cropVarietyId_fkey" FOREIGN KEY ("cropVarietyId") REFERENCES "CropVariety" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FarmRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmId" TEXT NOT NULL,
    "plotId" TEXT,
    "plantingId" TEXT,
    "creatorId" TEXT NOT NULL,
    "recordDate" DATETIME,
    "actionType" TEXT,
    "rawInput" TEXT NOT NULL,
    "transcript" TEXT,
    "structuredDataJson" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
    "confirmedBy" TEXT,
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FarmRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FarmRecord_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FarmRecord_plantingId_fkey" FOREIGN KEY ("plantingId") REFERENCES "Planting" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FarmRecord_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FarmRecord_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecordVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmRecordId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "structuredDataJson" TEXT NOT NULL,
    "editedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecordVersion_farmRecordId_fkey" FOREIGN KEY ("farmRecordId") REFERENCES "FarmRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecordVersion_editedBy_fkey" FOREIGN KEY ("editedBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmRecordId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_farmRecordId_fkey" FOREIGN KEY ("farmRecordId") REFERENCES "FarmRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmRecordId" TEXT,
    "provider" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "queryJson" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "EvidenceSnapshot_farmRecordId_fkey" FOREIGN KEY ("farmRecordId") REFERENCES "FarmRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "storyMaterials" TEXT NOT NULL DEFAULT '',
    "origin" TEXT NOT NULL DEFAULT '',
    "farmingMethod" TEXT NOT NULL DEFAULT '',
    "philosophy" TEXT NOT NULL DEFAULT '',
    "familyHistory" TEXT NOT NULL DEFAULT '',
    "sustainability" TEXT NOT NULL DEFAULT '',
    "productFeatures" TEXT NOT NULL DEFAULT '',
    "certificationInfo" TEXT NOT NULL DEFAULT '',
    "contactInfo" TEXT NOT NULL DEFAULT '',
    "tone" TEXT NOT NULL DEFAULT '樸實真誠',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BrandProfile_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "length" TEXT NOT NULL,
    "sourceDataJson" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "callToAction" TEXT NOT NULL,
    "hashtagsJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GeneratedContent_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GeneratedContent_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedContentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generatedContentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "callToAction" TEXT NOT NULL,
    "hashtagsJson" TEXT NOT NULL,
    "promptVersionId" TEXT,
    "modelName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedContentVersion_generatedContentId_fkey" FOREIGN KEY ("generatedContentId") REFERENCES "GeneratedContent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userPromptTemplate" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AIRequestLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL,
    "rawResponse" TEXT NOT NULL,
    "parsedResponseJson" TEXT,
    "tokenUsageJson" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIRequestLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgriculturalTerm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incorrectTerm" TEXT NOT NULL,
    "correctedTerm" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "cropId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "AgriculturalTerm_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Farm_ownerId_idx" ON "Farm"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "FarmMember_farmId_userId_key" ON "FarmMember"("farmId", "userId");

-- CreateIndex
CREATE INDEX "Plot_farmId_idx" ON "Plot"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_name_key" ON "Crop"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CropVariety_cropId_name_key" ON "CropVariety"("cropId", "name");

-- CreateIndex
CREATE INDEX "FarmRecord_farmId_recordDate_idx" ON "FarmRecord"("farmId", "recordDate");

-- CreateIndex
CREATE UNIQUE INDEX "RecordVersion_farmRecordId_version_key" ON "RecordVersion"("farmRecordId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_farmId_key" ON "BrandProfile"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedContentVersion_generatedContentId_version_key" ON "GeneratedContentVersion"("generatedContentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_key_version_key" ON "PromptTemplate"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AgriculturalTerm_incorrectTerm_correctedTerm_key" ON "AgriculturalTerm"("incorrectTerm", "correctedTerm");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
