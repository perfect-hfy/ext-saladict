import React, { useEffect, useState } from 'react'
import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'
import {
  withKnobs,
  select,
  number,
  object,
  boolean
} from '@storybook/addon-knobs'
import { withi18nNS, withSaladictPanel } from '@/_helpers/storybook'
import { DictItem } from '@/content/components/DictItem/DictItem'
import { getDefaultConfig, DictID } from '@/app-config'
import { getDefaultProfile } from '@/app-config/profiles'
import { SearchFunction, MockRequest } from './helpers'
import { getAllDicts } from '@/app-config/dicts'
import { useTranslate } from '@/_helpers/i18n'
import { timer } from '@/_helpers/promise-more'

const stories = storiesOf('Content Scripts|Dictionaries', module)
  .addParameters({
    backgrounds: [
      { name: 'Saladict', value: '#5caf9e', default: true },
      { name: 'Black', value: '#000' }
    ]
  })
  .addDecorator(withKnobs)
  .addDecorator(
    withSaladictPanel(
      <style>
        {require('@/content/components/DictItem/DictItem.scss').toString()}
      </style>
    )
  )
  .addDecorator(withi18nNS('content'))

Object.keys(getAllDicts()).forEach(id => {
  // @ts-ignore: wrong storybook typing
  stories.add(id, ({ fontSize, withAnimation }) => (
    <Dict
      key={id}
      dictID={id as DictID}
      fontSize={fontSize}
      withAnimation={withAnimation}
    />
  ))
})

function Dict(props: {
  dictID: DictID
  fontSize: number
  withAnimation: boolean
}) {
  const { i18n } = useTranslate()

  const {
    mockSearchTexts,
    mockRequest
  } = require('../../../test/specs/components/dictionaries/' +
    props.dictID +
    '/requests.mock.ts') as {
    mockSearchTexts: string[]
    mockRequest: MockRequest
  }

  const locales = require('@/components/dictionaries/' +
    props.dictID +
    '/_locales.json')

  const { search } = require('@/components/dictionaries/' +
    props.dictID +
    '/engine.ts') as { search: SearchFunction<any> }

  const searchText = select(
    'Search Text',
    mockSearchTexts.reduce((o, t) => ((o[t] = t), o), {}),
    mockSearchTexts[0]
  )

  const [status, setStatus] = useState<'IDLE' | 'SEARCHING' | 'FINISH'>('IDLE')
  const [result, setResult] = useState<any>(null)

  const [profiles, updateProfiles] = useState(() => getDefaultProfile())
  // custom dict options
  const options = profiles.dicts.all[props.dictID]['options']
  const optKeys = options ? Object.keys(options) : []
  const optValues = optKeys.map(key => {
    const name = locales.options[key][i18n.language]
    switch (typeof options[key]) {
      case 'boolean':
        return boolean(name, options[key])
      case 'number':
        return number(name, options[key])
      case 'string':
        const values: string[] =
          profiles.dicts.all[props.dictID]['options_sel'][key]
        return select(
          name,
          values.reduce(
            (o, k) => (
              (o[locales.options[`${key}-${k}`][i18n.language]] = k), o
            ),
            {}
          ),
          options[key]
        )
      default:
        return options[key]
    }
  })

  useEffect(() => {
    const newProfiles = getDefaultProfile()
    const newOptions = newProfiles.dicts.all[props.dictID]['options']
    optKeys.forEach((key, i) => {
      newOptions[key] = optValues[i]
    })
    updateProfiles(newProfiles)
  }, optValues)

  useEffect(() => {
    // mock requests
    const mock = new AxiosMockAdapter(axios)
    mockRequest(mock)
    mock.onAny().reply(config => {
      console.warn(`Unmatch url: ${config.url}`, config)
      return [404, {}]
    })
    return () => mock.restore()
  }, [])

  useEffect(() => {
    setStatus('SEARCHING')
    search(searchText, getDefaultConfig(), profiles, {
      isPDF: false
    }).then(async ({ result }) => {
      await timer(Math.random() * 3000)
      setStatus('FINISH')
      setResult(result)
    })
  }, [searchText, profiles])

  return (
    <DictItem
      dictID={props.dictID}
      text={searchText}
      fontSize={props.fontSize}
      withAnimation={props.withAnimation}
      preferredHeight={number('Preferred Height', 256)}
      searchStatus={status}
      searchResult={result}
      searchText={action('Search Text')}
      onHeightChanged={action('Height Changed')}
    />
  )
}