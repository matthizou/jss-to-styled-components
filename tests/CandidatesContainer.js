import React, { Fragment, useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { Card, Text } from '@xingternal/360-components'
import injectSheet from 'react-jss'
import {
  trackSearch,
  trackCheckboxChanges,
  trackStatusChange,
} from 'components/organisms/CandidatesSearchForm/utils/trackingHelper'
import { trigger, execute } from 'helpers/react-backbone'
import CandidatesSearchForm from 'components/organisms/CandidatesSearchForm/CandidatesSearchForm'
import { buildFacetQueryParams } from 'components/organisms/CandidatesSearchForm/utils/buildFacetQueryParams'
import illustration from 'containers/Pools/PoolCandidatesListContainer/Illustration.svg'
import { trackPoolEvent } from 'services/tracking/events'
import i18n from 'helpers/i18n'
import notifier from 'helpers/notifications'
import { default as useIsKeyDown } from 'helpers/hooks/useKeyDown/useIsKeyDown'
import WithLoader from 'components/atoms/WithLoader'
import {
  getCandidates,
  getCandidatures,
  getPoolReferral,
  optInChanged,
  updateCandidateStatus,
  getHaves,
  getStatuses,
  getFacets,
} from './services/api'
import { getUrlParams } from './utils/getUrlParams'
import {
  extractNames,
  normalizeFilters,
  updateCounts,
  sortStatuses,
} from './utils/candidatesHelper'
import CandidatesList from './components/CandidatesList/CandidatesList'
import { CandidatesListPropTypes } from './components/CandidatesList/types'

const i18ns = i18n({
  headline: '360_SMART_POOLS_SYNCING_HEADLINE',
  subline: '360_SMART_POOLS_SYNCING_SUBLINE',
  apiError: 'XTM_NOTIFICATION_FATAL_ERROR',
  unarchivedNotification: 'XTM_PROJECT_UNARCHIVED_NOTIFICATION',
})

const styles = {
  card: { composes: 'mt24 tac py64 centered-column large' },
  image: { composes: 'pb32' },
  text: { composes: 'pb12' },
}

const DEFAULT_STATUS_FILTERS = [
  { id: 'all', label: i18n('XTM_GLOBAL_CANDIDATE_STATUSES_ALL'), order: -1 },
  {
    id: 'none',
    label: i18n('XTM_GLOBAL_CANDIDATE_STATUSES_NONE'),
    order: 9999,
  },
]

const Syncing = injectSheet(styles)(({ classes }) => (
  <Card className={classes.card}>
    <img src={illustration} className={classes.image} />
    <Text size={22} bold className={classes.text}>
      {i18ns.headline}
    </Text>
    <Text size={18} className={classes.text}>
      {i18ns.subline}
    </Text>
  </Card>
))

export const getInitialStateFromProps = candidates =>
  candidates.reduce((result, candidate) => {
    result[candidate.id] = {
      identityId: candidate.identityId,
      lastProjects: [],
      lastPools: [],
      currentReferrals: [],
      loadingReferrals: false,
      loading: false,
      loaded: false,
      collapsed: true,
      selected: false,
      isExternal: candidate.profile.isExternal,
      photoUrl: candidate.profile.photoUrl,
    }
    return result
  }, {})

const isPoolHeaderFFEnabled = window.Featurer.isEnabled(
  'xtm_new_pool_details_header'
)

/**
 * Candidates tab container for pool details
 */
const CandidatesContainer = ({
  externalSort,
  onUnarchivePool,
  pool,
  updateFilters,
  candidates,
  setCandidates,
  isSelectedFilter,
  externalPage,
  externalStatus,
}) => {
  const [filters, setFilters] = useState({
    jobTitles: [],
    haves: [],
    cities: [],
    statuses: [],
    rawStatuses: [],
  })
  const [selected, setSelected] = useState({
    jobTitles: [],
    haves: [],
    cities: [],
    status: externalStatus ? externalStatus : null,
    page:
      isNaN(externalPage) || externalPage === null
        ? 1
        : parseInt(externalPage, 10),
  })
  const { jobTitles, haves, cities, status, page } = selected
  const [candidatesInternal, setCandidatesInternal] = useState({
    isEmptyPool: true,
  })
  const [total, setTotal] = useState(0)
  const [havesValue, setHavesValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  // TODO: temporary until pool header migration is done - xtm_new_pool_details_header
  const [isStatusesLoading, setIsStatusesLoading] = useState(true)
  const [currentPool, setCurrentPool] = useState(pool)
  const [shouldFiltersReload, setShouldFiltersReload] = useState(true)

  const firstUpdate = useRef(true)
  // TODO: temporary variable until pool header is integrated and - xtm_new_pool_details_header
  const candidatesTemporal = isPoolHeaderFFEnabled
    ? candidates
    : candidatesInternal
  // TODO: temporary function until pool header is integrated and migrated - xtm_new_pool_details_header
  const setCandidatesTemporal = data =>
    isPoolHeaderFFEnabled ? setCandidates(data) : setCandidatesInternal(data)
  const isLeftArrowKeyPressed = useIsKeyDown('ArrowLeft')
  const isRightArrowKeyPressed = useIsKeyDown('ArrowRight')

  const listActions = {
    onPageClick: page => {
      setSelected({
        ...selected,
        page,
      })
    },
    onGoToSearch: () => execute('navigate:search'),
    onUnarchivePool: () => {
      try {
        if (isPoolHeaderFFEnabled) {
          onUnarchivePool()
        } else {
          trigger('header:update')
        }
        setCurrentPool({ ...currentPool, archived: false })
        notifier.notifySuccess({
          message: i18ns.unarchivedNotification,
        })
      } catch (error) {
        notifier.notifyFail({
          message: i18ns.apiError,
        })
      }
    },
  }

  const findCandidate = candidateId =>
    candidatesTemporal.list.find(
      singleCandidate => singleCandidate.id === candidateId
    )

  const candidateCardActions = {
    onProfileClick: profileId => {
      execute('navigate:profile', profileId)
    },
    onExternalProfileClick: profileId =>
      execute('navigate:external:profile:profile', profileId),
    onPoolClick: poolId => execute('navigate:pools:show', poolId),
    onProjectClick: projectId => execute('navigate:projects:show', projectId),
    onPoolsClick: (profileId, isExternal) => {
      if (isExternal) {
        execute('navigate:external:profile:pools', profileId)
      } else {
        execute('navigate:profiles:pools', profileId)
      }
    },
    onProjectsClick: profileId =>
      execute('navigate:profiles:projects', profileId),
    onOptInChanged: async candidateId => {
      const candidate = findCandidate(candidateId)
      await optInChanged(candidateId, {
        id: candidateId,
        email_opt_in: !candidate.profile.emailOptIn,
      })
    },
    onGlanceOpen: (candidateId, identityId, isExternal) =>
      loadContent(candidateId, identityId, isExternal),
    onCardClick: candidateId =>
      setCandidatesTemporal({
        ...candidatesTemporal,
        entries: {
          ...candidatesTemporal.entries,
          [candidateId]: {
            ...candidatesTemporal.entries[candidateId],
            collapsed: !candidatesTemporal.entries[candidateId].collapsed,
          },
        },
      }),
    onStatusClick: async (candidateId, statusId) => {
      const candidate = findCandidate(candidateId)
      try {
        await updateCandidateStatus({
          ...candidate,
          poolCandidateStatusId: statusId || 'none',
        })
        if (
          !selected.status ||
          selected.status === DEFAULT_STATUS_FILTERS[0].id
        ) {
          onSearch()
        } else {
          onSearch(true)
        }
      } catch (error) {
        notifier.notifyFail({
          message: i18ns.apiError,
        })
      }
    },
    onSeeReferralsClicked: candidate => loadReferrals(candidate),
  }

  const loadContent = async (candidateId, identityId, isExternal) => {
    const candidateState = candidatesTemporal.entries[candidateId]

    if (candidateState.loaded || candidateState.loading) {
      return
    }

    setCandidatesTemporal({
      ...candidatesTemporal,
      entries: {
        ...candidatesTemporal.entries,
        [candidateId]: { ...candidateState, loading: true },
      },
    })

    try {
      const { data } = await getCandidatures(isExternal, identityId)
      setCandidatesTemporal({
        ...candidatesTemporal,
        entries: {
          ...candidatesTemporal.entries,
          [candidateId]: {
            ...candidateState,
            lastProjects: data.projects,
            lastPools: data.pools,
            loading: false,
            loaded: true,
          },
        },
      })
    } catch (error) {
      notifier.notifyFail({
        message: i18ns.apiError,
      })
    }
  }

  const loadReferrals = async candidate => {
    const { poolId, id } = candidate

    setCandidatesTemporal({
      ...candidatesTemporal,
      entries: {
        ...candidatesTemporal.entries,
        [candidate.id]: {
          ...candidatesTemporal.entries[candidate.id],
          currentReferrals: [],
          loadingReferrals: true,
        },
      },
    })

    try {
      const { data } = await getPoolReferral(poolId, id)
      setCandidatesTemporal({
        ...candidatesTemporal,
        entries: {
          ...candidatesTemporal.entries,
          [candidate.id]: {
            ...candidatesTemporal.entries[candidate.id],
            currentReferrals: data.entries,
            loadingReferrals: false,
          },
        },
      })
    } catch (error) {
      notifier.notifyFail({
        message: i18ns.apiError,
      })
    }
  }

  const setSearchValue = value => {
    if (value) {
      trackSearch('pool')
    }
    setSearchQuery(value)
  }

  const fetchHaves = async newHavesValue => {
    try {
      const response = await getHaves(newHavesValue)
      setFilters(prevState => ({
        ...prevState,
        haves: response.data.suggestions.slice(0, 5).map(s => {
          return { value: s.suggestion, name: s.suggestion }
        }),
      }))
    } catch (error) {
      notifier.notifyFail({
        message: i18ns.apiError,
      })
    }
  }

  const setSelectedCities = cities => {
    trackCheckboxChanges({
      candidateGroupType: 'pool',
      filter: 'cities',
      newValues: extractNames(cities),
      oldValues: extractNames(selected.cities),
    })
    setSelected(prevState => ({
      ...prevState,
      cities,
      page: 1,
    }))
  }

  const onSearch = async (loadPreviousPage = false) => {
    setIsLoading(true)
    setTotal(0)
    try {
      const { data } = await getCandidates(
        pool.id,
        getUrlParams(selectedFilterValues(loadPreviousPage))
      )
      setCandidatesTemporal({
        ...data,
        entries: getInitialStateFromProps(data.entries),
        list: data.entries,
      })

      setIsLoading(false)
      setTotal(data.total)
      trackPoolEvent({ page: 'pools/show', poolType: currentPool.poolType })
      if (isPoolHeaderFFEnabled) {
        updateFilters({
          filter: pool.poolStatusId,
          query: {
            filters: {
              city: cities.map(city => city.value),
              currentTitle: jobTitles.map(job => job.value),
            },
            keywords: searchQuery,
            haves,
          },
          sort: externalSort,
          total: data.total,
        })
      } else {
        trigger('campaign:params:from:react', {
          filters: {
            city: cities.map(city => city.value),
            current_title: jobTitles.map(job => job.value),
          },
          haves,
          keywords: searchQuery,
          sort: externalSort,
          total: data.total,
        })
      }
    } catch (error) {
      notifier.notifyFail({
        message: i18ns.apiError,
      })
    }
  }

  const fetchFacets = async type => {
    const queryParams = buildFacetQueryParams(type, selected)
    const response = await getFacets(pool.id, type, queryParams)

    return response
  }

  const selectedFilterValues = loadPreviousPage => {
    let currentPage = selected.page
    if (
      loadPreviousPage &&
      candidatesTemporal.currentPage > 1 &&
      candidatesTemporal.currentPage === candidatesTemporal.totalPages &&
      candidatesTemporal.list.length === 1
    ) {
      currentPage -= 1
    }
    return {
      searchQuery,
      haves: selected.haves.map(have => have.value),
      cities: selected.cities.map(city => city.value),
      jobTitles: selected.jobTitles.map(title => title.value),
      status: selected.status,
      page: currentPage,
      sort: externalSort,
    }
  }

  const getFilters = async (validation = true) => {
    try {
      const [currentTitleFacets, cityFacets] = await Promise.all([
        fetchFacets('current_title'),
        fetchFacets('city'),
      ])

      const updatedSelectedTitles = updateCounts(
        selected.jobTitles,
        currentTitleFacets.data.filters
      )
      const updatedSelectedCities = updateCounts(
        selected.cities,
        cityFacets.data.filters
      )

      setFilters(prevState => ({
        ...prevState,
        jobTitles: normalizeFilters(currentTitleFacets.data.filters),
        cities: normalizeFilters(cityFacets.data.filters),
      }))
      if (!validation) {
        setSelected(prevState => {
          setShouldFiltersReload(false)
          return {
            ...prevState,
            jobTitles: updatedSelectedTitles,
            cities: updatedSelectedCities,
            page: 1,
          }
        })
      }
    } catch (_) {
      notifier.notifyFail({
        message: i18ns.apiError,
      })
    }
  }

  const setSelectedJobTitles = jobTitles => {
    trackCheckboxChanges({
      candidateGroupType: 'pool',
      filter: 'current_position',
      newValues: extractNames(jobTitles),
      oldValues: extractNames(selected.jobTitles),
    })
    setSelected(prevState => ({
      ...prevState,
      jobTitles,
      page: 1,
    }))
  }

  const setSelectedHaves = haves => {
    trackCheckboxChanges({
      candidateGroupType: 'pool',
      filter: 'haves',
      newValues: extractNames(haves),
      oldValues: extractNames(selected.haves),
    })
    setSelected(prevState => ({
      ...prevState,
      haves,
      page: 1,
    }))
  }

  const setSelectedStatus = status => {
    trackStatusChange('pool', status.label)
    setSelected(prevState => ({
      ...prevState,
      status,
      page: 1,
    }))
  }

  const fetchStatuses = async () => {
    setIsStatusesLoading(true)
    const response = await getStatuses('pool')
    setFilters({ ...filters, rawStatuses: response.data })
    const statuses = response.data.map(status => {
      return {
        id: status.id,
        label: status.name,
        order: status.order,
      }
    })
    const sortedStatuses = sortStatuses([
      ...statuses,
      ...DEFAULT_STATUS_FILTERS,
    ])
    setFilters(prevState => ({
      ...prevState,
      statuses: sortedStatuses,
    }))

    if (externalStatus) {
      const externalStatusParsed = isNaN(externalStatus)
        ? externalStatus
        : parseInt(externalStatus, 10)
      const selectedStatus = sortedStatuses.find(
        status => status.id === externalStatusParsed
      )
      if (selectedStatus) {
        setShouldFiltersReload(false)
        setSelected(prevState => ({
          ...prevState,
          status: selectedStatus,
        }))
      }
    }
    setIsStatusesLoading(false)
  }

  const syncing = pool.poolType === 'smart' && !pool.firstSyncComplete

  const {
    hasXtm,
    hasXtp,
    fencingRole,
    identityId,
  } = window.bootstrap.currentUser

  useEffect(() => {
    fetchHaves(havesValue)
  }, [havesValue])

  useEffect(() => {
    if (candidatesTemporal.list && isPoolHeaderFFEnabled) {
      setIsLoading(false)
      setTotal(candidatesTemporal.total)
    }
  }, [candidatesTemporal])

  const loadInitial = async () => {
    getFilters()
    fetchStatuses()
    if (!isPoolHeaderFFEnabled && !externalSort) {
      onSearch()
    }
  }

  useEffect(() => {
    if (externalSort && firstUpdate.current && !isPoolHeaderFFEnabled) {
      onSearch()
    }
  }, [status])

  useEffect(() => {
    loadInitial()
  }, [])

  useEffect(() => {
    trigger(
      'react:url:status::update',
      getUrlParams({
        sort: externalSort,
        status,
        page,
      })
    )
  }, [status, externalSort, page])

  useEffect(() => {
    if (!firstUpdate.current) {
      onSearch()
    }
  }, [page])

  useEffect(() => {
    if (firstUpdate.current) {
      firstUpdate.current = false
    } else {
      if (shouldFiltersReload) {
        getFilters(false)
        onSearch()
      } else {
        setShouldFiltersReload(true)
      }
    }
  }, [jobTitles, haves, cities, status, searchQuery])

  useEffect(() => {
    if (
      (isPoolHeaderFFEnabled && externalSort && isSelectedFilter) ||
      (!isPoolHeaderFFEnabled && externalSort)
    ) {
      onSearch()
    }
  }, [externalSort])

  useEffect(() => {
    if (isLeftArrowKeyPressed && candidatesTemporal.currentPage > 1) {
      setSelected({
        ...selected,
        page: candidatesTemporal.currentPage - 1,
      })
    }
  }, [isLeftArrowKeyPressed])

  useEffect(() => {
    if (
      isRightArrowKeyPressed &&
      candidatesTemporal.currentPage < candidatesTemporal.totalPages
    ) {
      setSelected({
        ...selected,
        page: candidatesTemporal.currentPage + 1,
      })
    }
  }, [isRightArrowKeyPressed])

  return (
    <Fragment>
      {candidatesTemporal && !candidatesTemporal.isEmptyPool && (
        <CandidatesSearchForm
          placeholder={i18n('XTP_POOLS_SEARCH_CANDIDATES_PLACEHOLDER')}
          filters={filters}
          selected={selected}
          total={total}
          searchValue={setSearchValue}
          havesValue={setHavesValue}
          searchQuery={searchQuery}
          selectedStatus={selected.status}
          selectedCities={setSelectedCities}
          selectedJobTitles={setSelectedJobTitles}
          selectedHaves={setSelectedHaves}
          setSelectedStatus={setSelectedStatus}
          candidateGroupType={'pool'}
        />
      )}
      {syncing ? (
        <Syncing />
      ) : (
        <WithLoader isLoading={isLoading || isStatusesLoading}>
          <CandidatesList
            candidates={candidatesTemporal}
            currentPool={currentPool}
            rawStatuses={filters.rawStatuses}
            noResults={!candidatesTemporal.isEmptyPool}
            totalPages={candidatesTemporal.totalPages}
            currentPage={candidatesTemporal.currentPage}
            hasXTM={hasXtm}
            hasXTP={hasXtp}
            fencingRole={fencingRole}
            setCandidates={setCandidatesTemporal}
            currentUserId={identityId}
            listActions={listActions}
            candidateCardActions={candidateCardActions}
            fetchCandidates={onSearch}
          />
        </WithLoader>
      )}
    </Fragment>
  )
}

CandidatesContainer.propTypes = {
  externalSort: PropTypes.string,
  externalPage: PropTypes.string,
  externalStatus: PropTypes.string,
  onUnarchivePool: PropTypes.func,
  /** Current pool */
  pool: PropTypes.PropTypes.shape({
    /** Whether the pool is archived or not*/
    archived: PropTypes.bool,
    /** Company Id related to the pool*/
    companyId: PropTypes.number,
    /** Creator id of the pool */
    creatorId: PropTypes.number,
    /** Date when the pool was created*/
    createdAt: PropTypes.string,
    /** Whether the first sync is completet or not */
    firstSyncComplete: PropTypes.bool,
    /** Whether the pool has new events or not*/
    hasNewEvents: PropTypes.bool,
    /** Id of the pool */
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    /** Job description related to the pool*/
    jobDescription: PropTypes.string,
    /** Name of the pool*/
    name: PropTypes.string,
    /** Type of the pool*/
    poolType: PropTypes.string,
    /** Pool status id*/
    poolStatusId: PropTypes.number,
    /** Whether if the pool is public or not*/
    public: PropTypes.bool,
  }),
  /** Update filters applied to get the candidates */
  updateFilters: PropTypes.func,
  candidates: CandidatesListPropTypes.candidates,
  setCandidates: PropTypes.func,
  /** Temporary boolean to avoid multiple render when FF is enabled*/
  isSelectedFilter: PropTypes.bool,
}

CandidatesContainer.defaultProps = {
  candidates: {},
}

export default CandidatesContainer
