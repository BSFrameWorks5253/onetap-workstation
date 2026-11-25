package com.onetap.studiotracker.ui.screens.kanban

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.models.SafarTask
import com.onetap.studiotracker.data.models.Stage
import com.onetap.studiotracker.data.repository.SafarRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

class KanbanViewModel : ViewModel() {

    private val repository: SafarRepository = SafarRepository.getInstance()

    val campaigns: StateFlow<List<SafarCampaign>> = repository.campaigns

    val activeCampaign: StateFlow<SafarCampaign?> = repository.campaigns.map { list ->
        list.firstOrNull { it.isOngoing } ?: list.firstOrNull { !it.isArchived } ?: list.firstOrNull()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    private val _selectedStage = MutableStateFlow(Stage.EDITING_PENDING)
    val selectedStage: StateFlow<Stage> = _selectedStage.asStateFlow()

    fun selectStage(stage: Stage) {
        _selectedStage.value = stage
    }

    fun advanceTaskStage(task: SafarTask) {
        task.stage.nextStage?.let { repository.updateTaskStage(task.id, it) }
    }

    fun regressTaskStage(task: SafarTask) {
        task.stage.prevStage?.let { repository.updateTaskStage(task.id, it) }
    }

    fun setTaskStage(taskId: String, stage: Stage) {
        repository.updateTaskStage(taskId, stage)
    }

    fun bulkSetStage(taskIds: Set<String>, stage: Stage) {
        repository.bulkUpdateTaskStage(taskIds, stage)
    }

    fun addManualTask(safarName: String, dateFolder: String, notes: String?) {
        repository.addManualTask(safarName, dateFolder, notes)
    }

    fun excludeTask(task: SafarTask) {
        repository.excludeTask(task.campaignId, task.id, task.title)
    }
}
