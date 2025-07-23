"use client"
import useDataStore from '@/stores/dataStore'
import React from 'react'

const page = () => {
  const { productsData } = useDataStore()
  return (
    <div>
      {productsData.phones && productsData.phones.map((phone) => (
        <h1 key={phone.id} className='text-2xl'>{phone.title}</h1>
      ))}
    </div>
  )
}

export default page
