package com.onetap.studiotracker.data.repository

import com.onetap.studiotracker.data.models.PhotoStage
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.models.SafarTask
import com.onetap.studiotracker.data.models.Stage

object SampleDataProvider {
    fun getSampleCampaigns(): List<SafarCampaign> {
        val mumbaiTasks = listOf(
            SafarTask(
                id = "mum-01",
                campaignId = "camp-mumbai-1447-06",
                title = "Day 1 - Majlis Opening",
                hijriDate = "1447-06-01",
                gregorianDate = "2025-11-20",
                stage = Stage.ALJAMEA_DONE,
                videoEditor = "Mustafa",
                durationMinutes = 48,
                driveFolderUrl = "https://drive.google.com/drive/folders/mumbai-day1",
                totalPhotos = 120,
                uploadedPhotos = 120,
                photoStage = PhotoStage.DRIVE_UPLOADED,
                notes = "Color grading and raw masters verified"
            ),
            SafarTask(
                id = "mum-02",
                campaignId = "camp-mumbai-1447-06",
                title = "Day 2 - Morning Ziyarat",
                hijriDate = "1447-06-02",
                gregorianDate = "2025-11-21",
                stage = Stage.UPLOADED,
                videoEditor = "Ali",
                durationMinutes = 52,
                driveFolderUrl = "https://drive.google.com/drive/folders/mumbai-day2",
                totalPhotos = 150,
                uploadedPhotos = 150,
                photoStage = PhotoStage.DRIVE_UPLOADED,
                notes = "Uploaded to cloud storage"
            ),
            SafarTask(
                id = "mum-03",
                campaignId = "camp-mumbai-1447-06",
                title = "Day 3 - Community Gathering",
                hijriDate = "1447-06-03",
                gregorianDate = "2025-11-22",
                stage = Stage.UPLOADED,
                videoEditor = "Hussain",
                durationMinutes = 65,
                driveFolderUrl = "https://drive.google.com/drive/folders/mumbai-day3",
                totalPhotos = 95,
                uploadedPhotos = 95,
                photoStage = PhotoStage.DRIVE_UPLOADED,
                notes = "All cuts finalized"
            ),
            SafarTask(
                id = "mum-04",
                campaignId = "camp-mumbai-1447-06",
                title = "Day 4 - Darbar Sharifs",
                hijriDate = "1447-06-04",
                gregorianDate = "2025-11-23",
                stage = Stage.UPLOADED,
                videoEditor = "Mustafa",
                durationMinutes = 70,
                driveFolderUrl = "https://drive.google.com/drive/folders/mumbai-day4",
                totalPhotos = 180,
                uploadedPhotos = 180,
                photoStage = PhotoStage.DRIVE_UPLOADED,
                notes = "Master export complete"
            ),
            SafarTask(
                id = "mum-05",
                campaignId = "camp-mumbai-1447-06",
                title = "Day 5 - Special Majlis",
                hijriDate = "1447-06-05",
                gregorianDate = "2025-11-24",
                stage = Stage.UPLOAD_PENDING,
                videoEditor = "Ali",
                durationMinutes = 55,
                driveFolderUrl = "https://drive.google.com/drive/folders/mumbai-day5",
                totalPhotos = 140,
                uploadedPhotos = 70,
                photoStage = PhotoStage.COLOR_GRADED,
                notes = "Exporting 4K master"
            ),
            SafarTask(
                id = "mum-06",
                campaignId = "camp-mumbai-1447-06",
                title = "Day 6 - Cultural Assembly",
                hijriDate = "1447-06-06",
                gregorianDate = "2025-11-25",
                stage = Stage.IN_PROGRESS,
                videoEditor = "Hussain",
                durationMinutes = 60,
                driveFolderUrl = "https://drive.google.com/drive/folders/mumbai-day6",
                totalPhotos = 130,
                uploadedPhotos = 0,
                photoStage = PhotoStage.RAW_SORTED,
                notes = "B-roll assembly in timeline"
            ),
            SafarTask(
                id = "mum-07",
                campaignId = "camp-mumbai-1447-06",
                title = "Day 7 - Youth Session",
                hijriDate = "1447-06-07",
                gregorianDate = "2025-11-26",
                stage = Stage.EDITING_PENDING,
                videoEditor = "Mustafa",
                durationMinutes = 45,
                driveFolderUrl = null,
                totalPhotos = 110,
                uploadedPhotos = 0,
                photoStage = PhotoStage.PENDING,
                notes = "Card ingestion in progress"
            ),
            SafarTask(
                id = "mum-08",
                campaignId = "camp-mumbai-1447-06",
                title = "Day 8 - Grand Valedictory",
                hijriDate = "1447-06-08",
                gregorianDate = "2025-11-27",
                stage = Stage.EDITING_PENDING,
                videoEditor = "Ali",
                durationMinutes = 90,
                driveFolderUrl = null,
                totalPhotos = 200,
                uploadedPhotos = 0,
                photoStage = PhotoStage.PENDING,
                notes = "Scheduled"
            )
        )

        val mumbaiCampaign = SafarCampaign(
            id = "camp-mumbai-1447-06",
            name = "1447-06 Safar Mubaraka - Mumbai",
            location = "Mumbai, India",
            isOngoing = true,
            startDate = "2025-11-20",
            endDate = "2025-11-27",
            tasks = mumbaiTasks
        )

        val karachiCampaign = SafarCampaign(
            id = "camp-karachi-1447-05",
            name = "1447-05 Safar Mubaraka - Karachi",
            location = "Karachi, Pakistan",
            isOngoing = false,
            startDate = "2025-10-15",
            endDate = "2025-10-21",
            tasks = listOf(
                SafarTask(
                    id = "khi-01",
                    campaignId = "camp-karachi-1447-05",
                    title = "Day 1 - Arrival & Welcome",
                    hijriDate = "1447-05-15",
                    gregorianDate = "2025-10-15",
                    stage = Stage.ALJAMEA_DONE,
                    videoEditor = "Ali",
                    durationMinutes = 60,
                    totalPhotos = 160,
                    uploadedPhotos = 160,
                    photoStage = PhotoStage.DRIVE_UPLOADED
                ),
                SafarTask(
                    id = "khi-02",
                    campaignId = "camp-karachi-1447-05",
                    title = "Day 2 - Main Discourse",
                    hijriDate = "1447-05-16",
                    gregorianDate = "2025-10-16",
                    stage = Stage.ALJAMEA_DONE,
                    videoEditor = "Mustafa",
                    durationMinutes = 75,
                    totalPhotos = 210,
                    uploadedPhotos = 210,
                    photoStage = PhotoStage.DRIVE_UPLOADED
                )
            )
        )

        val londonCampaign = SafarCampaign(
            id = "camp-london-1447-04",
            name = "1447-04 Safar Mubaraka - London",
            location = "London, UK",
            isOngoing = false,
            startDate = "2025-09-10",
            endDate = "2025-09-14",
            tasks = listOf(
                SafarTask(
                    id = "lon-01",
                    campaignId = "camp-london-1447-04",
                    title = "Day 1 - Northolt Assembly",
                    hijriDate = "1447-04-10",
                    gregorianDate = "2025-09-10",
                    stage = Stage.ALJAMEA_DONE,
                    videoEditor = "Hussain",
                    durationMinutes = 55,
                    totalPhotos = 145,
                    uploadedPhotos = 145,
                    photoStage = PhotoStage.DRIVE_UPLOADED
                )
            )
        )

        return listOf(mumbaiCampaign, karachiCampaign, londonCampaign)
    }
}
